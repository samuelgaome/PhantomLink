import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Contract, Wallet, ethers } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { encryptMessageWithAddress } from '../lib/crypto';
import '../styles/MessageComposer.css';

type MessageComposerProps = {
  onSent: () => void;
  instance: any;
  isLoading: boolean;
  error: string | null;
};

export function MessageComposer({ onSent, instance, isLoading, error }: MessageComposerProps) {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner();

  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('');

    if (!isConnected || !address) {
      setStatus('Connect your wallet to send a message.');
      return;
    }

    if (!instance || !signerPromise) {
      setStatus('Encryption instance not ready yet.');
      return;
    }

    if (!ethers.isAddress(recipient)) {
      setStatus('Recipient address is invalid.');
      return;
    }

    if (!message.trim()) {
      setStatus('Message cannot be empty.');
      return;
    }

    setIsSending(true);
    try {
      const normalizedRecipient = ethers.getAddress(recipient);
      const ephemeral = Wallet.createRandom();

      const encryptedContent = encryptMessageWithAddress(message, ephemeral.address);
      const buffer = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      buffer.addAddress(ephemeral.address);
      const encryptedInput = await buffer.encrypt();

      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setStatus('Submitting transaction...');
      const tx = await contract.sendMessage(
        normalizedRecipient,
        encryptedContent,
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );
      await tx.wait();

      setStatus('Delivered on-chain. Recipient can now decrypt the key.');
      setLastKey(ephemeral.address);
      setMessage('');
      onSent();
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error';
      setStatus(`Failed to send: ${reason}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="panel composer-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Compose</p>
          <h3>Send an encrypted drop</h3>
        </div>
        <span className={`badge ${instance && !isLoading ? 'badge-live' : 'badge-muted'}`}>
          {isLoading ? 'Initializing relayer' : instance ? 'Relayer ready' : 'Relayer unavailable'}
        </span>
      </div>

      <form className="composer-form" onSubmit={handleSend}>
        <label className="field-label">
          Recipient address
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="field-input"
          />
        </label>

        <label className="field-label">
          Message
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share instructions, passwords, coordinates—anything you want gated by FHE."
            className="field-textarea"
            rows={5}
          />
        </label>

        <button className="primary-button" type="submit" disabled={isSending || isLoading}>
          {isSending ? 'Sending...' : 'Encrypt and send'}
        </button>
      </form>

      {status && <p className="status-line">{status}</p>}
      {error && <p className="error-line">{error}</p>}
      {lastKey && (
        <p className="hint-line">
          Ephemeral key on-chain: <span className="mono">{lastKey}</span>
        </p>
      )}
    </div>
  );
}
