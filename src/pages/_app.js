// src/pages/_app.js
import { useState } from "react";
import "../styles/globals.css";

import {
  ThirdwebProvider,
  metamaskWallet,
  coinbaseWallet,
  walletConnect,
  rainbowWallet,
  coreWallet,
} from "@thirdweb-dev/react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools"; // optional

const activeChain = {
  chainId: 43114,
  rpc: ["https://api.avax.network/ext/bc/C/rpc"],
  nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  shortName: "avax",
  slug: "avalanche",
  name: "Avalanche",
  testnet: false,
};

export default function App({ Component, pageProps }) {
  // ensure a single QueryClient instance (survives HMR)
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
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
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  );
}