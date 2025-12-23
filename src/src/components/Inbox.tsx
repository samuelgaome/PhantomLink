import { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { decryptMessageWithAddress } from '../lib/crypto';
import '../styles/Inbox.css';

type InboxProps = {
  refreshKey: number;
  instance: any;
  isLoading: boolean;
};

type StoredMessage = {
  index: number;
  sender: string;
  encryptedMessage: string;
  encryptedKey: string;
  timestamp: bigint;
};

export function Inbox({ refreshKey, instance, isLoading: zamaLoading }: InboxProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const signerPromise = useEthersSigner();

  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [decryptingIndex, setDecryptingIndex] = useState<number | null>(null);
  const [loadError, setLoadError] = useState('');
  const [decrypted, setDecrypted] = useState<Record<number, { key: string; message: string }>>({});

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!address || !publicClient) {
        setMessages([]);
        return;
      }

      setIsLoading(true);
      try {
        const count = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'messageCount',
          args: [address],
        })) as bigint;

        const items: StoredMessage[] = [];
        for (let i = 0; i < Number(count); i++) {
          const data = (await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getMessage',
            args: [address, BigInt(i)],
          })) as [string, string, string, bigint];

          items.push({
            index: i,
            sender: data[0],
            encryptedMessage: data[1],
            encryptedKey: data[2],
            timestamp: BigInt(data[3]),
          });
        }

        if (mounted) {
          setMessages(items.reverse());
          setLoadError('');
        }
      } catch (err) {
        if (mounted) {
          const reason = err instanceof Error ? err.message : 'Failed to load inbox.';
          setLoadError(reason);
          setMessages([]);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [address, publicClient, refreshKey]);

  const decryptMessage = async (message: StoredMessage) => {
    if (!address || !instance || !signerPromise) {
      setLoadError('Missing wallet, signer, or relayer.');
      return;
    }

    setDecryptingIndex(message.index);
    setLoadError('');

    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        {
          handle: message.encryptedKey as string,
          contractAddress: CONTRACT_ADDRESS,
        },
      ];

      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

      const signer = await signerPromise;
      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      );

      const decryptedKey = result[message.encryptedKey as string];
      const clearMessage = decryptMessageWithAddress(message.encryptedMessage, decryptedKey);

      setDecrypted((prev) => ({
        ...prev,
        [message.index]: { key: decryptedKey, message: clearMessage },
      }));
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to decrypt.';
      setLoadError(reason);
    } finally {
      setDecryptingIndex(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="panel inbox-panel">
        <p className="eyebrow">Inbox</p>
        <h3>Connect to view messages</h3>
        <p className="muted">Your encrypted deliveries will appear here once a wallet is connected.</p>
      </div>
    );
  }

  return (
    <div className="panel inbox-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Inbox</p>
          <h3>Messages for you</h3>
        </div>
        <span className="badge badge-muted">
          {zamaLoading ? 'Syncing relayer' : `${messages.length} ${messages.length === 1 ? 'item' : 'items'}`}
        </span>
      </div>

      {loadError && <p className="error-line">{loadError}</p>}
      {isLoading && <p className="muted">Loading inbox...</p>}

      {!isLoading && messages.length === 0 && !loadError ? (
        <p className="muted">No encrypted drops yet. Ask a friend to send you one.</p>
      ) : null}

      <div className="message-list">
        {messages.map((item) => {
          const decryptedItem = decrypted[item.index];

          return (
            <div key={`${item.index}-${item.encryptedKey}`} className="message-card">
              <div className="message-top">
                <div>
                  <p className="muted">From</p>
                  <p className="mono">{item.sender}</p>
                </div>
                <div className="timestamp">
                  {new Date(Number(item.timestamp) * 1000).toLocaleString()}
                </div>
              </div>

              <div className="message-body">
                <p className="muted">Encrypted payload</p>
                <p className="cipher">{item.encryptedMessage}</p>
                <p className="muted">Encrypted key handle</p>
                <p className="mono small">{item.encryptedKey}</p>
              </div>

              {decryptedItem ? (
                <div className="decrypted-block">
                  <p className="muted">Ephemeral key</p>
                  <p className="mono">{decryptedItem.key}</p>
                  <p className="muted">Clear message</p>
                  <p className="clear-message">{decryptedItem.message}</p>
                </div>
              ) : (
                <button
                  className="secondary-button"
                  onClick={() => decryptMessage(item)}
                  disabled={decryptingIndex === item.index || zamaLoading}
                >
                  {decryptingIndex === item.index ? 'Decrypting...' : 'Decrypt and reveal'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
