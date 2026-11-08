"use client";

import dynamic from "next/dynamic";
import { useMemo, type ComponentType, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import "@solana/wallet-adapter-react-ui/styles.css";

type SafeComponent = ComponentType<{ children?: ReactNode } & Record<string, unknown>>;

const SafeConnectionProvider = ConnectionProvider as unknown as SafeComponent;
const SafeWalletProvider = WalletProvider as unknown as SafeComponent;

const ShieldApp = dynamic(() => import("@/components/ShieldApp"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center text-sm text-mute">
      Loading Solana Shield…
    </div>
  ),
});

export default function Providers() {
  const endpoint =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <SafeConnectionProvider endpoint={endpoint}>
      <SafeWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ShieldApp />
        </WalletModalProvider>
      </SafeWalletProvider>
    </SafeConnectionProvider>
  );
}
