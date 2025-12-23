import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from './Header';
import { MessageComposer } from './MessageComposer';
import { Inbox } from './Inbox';
import { useZamaInstance } from '../hooks/useZamaInstance';
import '../styles/MessengerApp.css';

export function MessengerApp() {
  const { address, isConnected } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);
  const zama = useZamaInstance();

  return (
    <div className="messenger-app">
      <Header />
      <main className="messenger-body">
        <section className="hero-card">
          <div className="hero-text">
            <p className="eyebrow">Encrypted drops</p>
            <h1>PhantomLink courier</h1>
            <p className="hero-copy">
              Write a note, lock it with a random EVM address, and ship both to your friend. Zama FHE keeps
              the ephemeral key hidden on-chain until the recipient decrypts it.
            </p>
            <div className="hero-pills">
              <span>Randomized key per message</span>
              <span>FHE-protected key handle</span>
              <span>Viem reads · Ethers writes</span>
            </div>
          </div>
          <div className="status-block">
            <p className="status-label">Wallet status</p>
            <p className="status-value">
              {isConnected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Not connected'}
            </p>
            <p className="status-hint">
              Connect to see your inbox and decrypt the ephemeral key stored with each message.
            </p>
          </div>
        </section>

        <section className="grid-panels">
          <MessageComposer
            onSent={() => setRefreshKey((key) => key + 1)}
            instance={zama.instance}
            isLoading={zama.isLoading}
            error={zama.error}
          />
          <Inbox refreshKey={refreshKey} instance={zama.instance} isLoading={zama.isLoading} />
        </section>
      </main>
    </div>
  );
}
