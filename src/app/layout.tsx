import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solana Shield — Stop Address Poisoning Before You Send",
  description:
    "Paste any Solana address and instantly see whether it is a poisoned lookalike of an address you have already used.",
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
