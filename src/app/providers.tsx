"use client";

import dynamic from "next/dynamic";

const WalletShell = dynamic(() => import("@/components/WalletShell"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center text-sm text-mute">
      Loading Solana Shield…
    </div>
  ),
});

export default function Providers() {
  return <WalletShell />;
}
