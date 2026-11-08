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

/** Keeps dust visible: 0.000001 SOL must not render as "0 SOL". */
export function formatSolPrecise(lamports: number): string {
  if (lamports === 0) return "0 SOL";
  if (lamports < 1_000_000) {
    const raw = (lamports / 1_000_000_000).toFixed(9);
    return `${raw.replace(/0+$/, "").replace(/\.$/, "")} SOL`;
  }
  return `${(lamports / 1_000_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  })} SOL`;
}

export function formatDateRange(start: number | null, end: number | null): string {
  if (!start || !end) return "no dated transactions";
  const format = (value: number) =>
    new Date(value * 1000).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  return `${format(start)} → ${format(end)}`;
}

export function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}
