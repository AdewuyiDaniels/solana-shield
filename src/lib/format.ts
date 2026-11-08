export function timeAgo(unixSeconds: number | null): string {
  if (!unixSeconds) return "unknown";
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

export function formatSol(lamports: number): string {
  return `${(lamports / 1_000_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })} SOL`;
}

export function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}
