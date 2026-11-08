import { decodeBase58 } from "./base58";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function normalizeAddress(input: string | null | undefined): string {
  let value = (input ?? "").trim();
  if (value.toLowerCase().startsWith("solana:")) {
    value = value.slice("solana:".length);
    value = value.split("?")[0];
  }
  return value.replace(/\s+/g, "");
}

export function decodeAddress(input: string): Uint8Array | null {
  const value = normalizeAddress(input);
  if (!BASE58_RE.test(value)) return null;
  const bytes = decodeBase58(value);
  if (!bytes || bytes.length !== 32) return null;
  return bytes;
}

export function isValidSolanaAddress(input: string): boolean {
  return decodeAddress(input) !== null;
}

export function shortAddress(address: string, chars = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}
