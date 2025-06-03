import "@/styles/globals.css";
import {
  ThirdwebProvider,
  metamaskWallet,
  coinbaseWallet,
  walletConnect,
  rainbowWallet,
  coreWallet,
} from "@thirdweb-dev/react";

const activeChain = {
  chainId: 43114,
  rpc: ["https://api.avax.network/ext/bc/C/rpc"],
  nativeCurrency: {
    name: "Avalanche",
    symbol: "AVAX",
    decimals: 18,
  },
  shortName: "avax",
  slug: "avalanche",
  name: "Avalanche",
  testnet: false,
};

export default function App({ Component, pageProps }) {
  return (
    <ThirdwebProvider
      clientId={process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}
      activeChain={activeChain}
      supportedWallets={[
        metamaskWallet(),
        walletConnect(),
        coinbaseWallet(),
        rainbowWallet(),
        coreWallet(),
      ]}
    >
      <Component {...pageProps} />
    </ThirdwebProvider>
  );
}