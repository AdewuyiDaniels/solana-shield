"use client";

import { useEffect, useState } from "react";
import { shortAddress } from "@/lib/address";

interface CopyGuardProps {
  value: string;
  risky: boolean;
  warning?: string;
  reference?: string | null;
  label?: string;
}

export function CopyGuard({ value, risky, warning, reference, label }: CopyGuardProps) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!confirming) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirming(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming]);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
    setConfirming(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (risky ? setConfirming(true) : copyValue())}
        className={
          risky
            ? "inline-flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger transition hover:bg-danger/15"
            : "inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/5"
        }
      >
        {copied ? "Copied" : (label ?? (risky ? "Copy (guarded)" : "Copy address"))}
      </button>

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md animate-rise rounded-2xl border border-danger/40 bg-panel p-6 shadow-glow">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/15 text-lg font-black text-danger">
                !
              </span>
              <h3 className="text-lg font-bold text-white">This address looks poisoned</h3>
            </div>
            <p className="text-sm text-slate-300">
              {warning ??
                "It matches the visible start and end of an address you have used before, which is the signature of an address-poisoning attack."}
            </p>
            {reference ? (
              <div className="mt-4 rounded-xl border border-line bg-black/30 p-3">
                <p className="label mb-1">The address you have used</p>
                <code className="mono break-all text-xs text-safe">
                  {reference}
                </code>
              </div>
            ) : null}
            <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-3">
              <p className="label mb-1 text-danger">You are copying</p>
              <code className="mono break-all text-xs text-danger">{value}</code>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="btn-primary flex-1"
              >
                Go back — safest choice
              </button>
              <button
                type="button"
                onClick={copyValue}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-mute transition hover:bg-white/5"
              >
                Copy anyway
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-mute">
              Never send funds to {shortAddress(value)}. Confirm the full address with the recipient.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
