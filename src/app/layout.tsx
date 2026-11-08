import type { Metadata, Viewport } from "next";
import "./globals.css";

const site = "https://solana-shield.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "Solana Shield — check an address against your history",
  description:
    "Paste a Solana address and see whether it is a poisoned lookalike of a counterparty you already transact with. Client-side, no keys, no server.",
  applicationName: "Solana Shield",
  openGraph: {
    type: "website",
    url: site,
    siteName: "Solana Shield",
    title: "Solana Shield — check an address against your history",
    description:
      "Detects address poisoning on Solana: lookalikes that copy the first and last characters of a wallet you already use.",
  },
  twitter: {
    card: "summary",
    title: "Solana Shield",
    description:
      "Check a Solana address against your own transaction history before you send.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
