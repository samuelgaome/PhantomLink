import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'PhantomLink Courier',
  projectId: 'b2277f7b2c58f0b66b74a585cd49007f',
  chains: [sepolia],
  ssr: false,
});
