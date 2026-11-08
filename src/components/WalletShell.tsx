"use client";

import { useMemo, type ComponentType, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { useStandardWalletAdapters } from "@solana/wallet-standard-wallet-adapter-react";
import type { Adapter } from "@solana/wallet-adapter-base";
import "@solana/wallet-adapter-react-ui/styles.css";
import ShieldApp from "@/components/ShieldApp";

type SafeComponent = ComponentType<{ children?: ReactNode } & Record<string, unknown>>;

const SafeConnectionProvider = ConnectionProvider as unknown as SafeComponent;
const SafeWalletProvider = WalletProvider as unknown as SafeComponent;

const DEFAULT_ENDPOINT = "https://solana-rpc.publicnode.com";

export default function WalletShell() {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_ENDPOINT;

  const baseAdapters = useMemo<Adapter[]>(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  const wallets = useStandardWalletAdapters(baseAdapters);

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
