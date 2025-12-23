import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="brand">
          <div className="brand-mark">PL</div>
          <div>
            <p className="brand-label">PhantomLink</p>
            <p className="brand-sub">Encrypted courier on Sepolia + Zama FHE</p>
          </div>
        </div>
        <div className="header-actions">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
