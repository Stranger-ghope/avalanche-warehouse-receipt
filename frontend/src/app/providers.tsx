"use client";

import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "wagmi/connectors";
import { Toaster } from "sonner";

const config = createConfig({
  chains: [avalancheFuji],
  connectors: [injected()],
  transports: {
    [avalancheFuji.id]: http("https://api.avax-test.network/ext/bc/C/rpc"),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="bottom-right" />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
