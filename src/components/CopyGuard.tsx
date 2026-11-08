"use client";

import { useEffect, useState } from "react";
import { shortAddress } from "@/lib/address";

interface CopyGuardProps {
  value: string;
  risky: boolean;
  warning?: string;
  reference?: string | null;
  label?: string;
  variant?: "primary" | "secondary";
}

export function CopyGuard({
  value,
  risky,
  warning,
  reference,
  label,
  variant = "secondary",
}: CopyGuardProps) {
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

  async function copy(target: string) {
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
    } catch {
      setCopied(false);
    }
    setConfirming(false);
  }

  const buttonClass =
    variant === "primary"
      ? "btn-primary"
      : risky
        ? "btn-secondary border-danger/40 text-danger hover:border-danger/60 hover:bg-danger/10"
        : "btn-secondary";

  return (
    <>
      <button
        type="button"
        onClick={() => (risky ? setConfirming(true) : void copy(value))}
        className={buttonClass}
      >
        {copied ? "Copied" : (label ?? (risky ? "Copy (guarded)" : "Copy address"))}
      </button>

      {confirming ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="copy-guard-title"
        >
          <div className="w-full max-w-lg rounded-lg border border-danger/40 bg-panel">
            <div className="border-b border-line px-5 py-3">
              <p className="mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-danger">
                Copy blocked
              </p>
              <h3
                id="copy-guard-title"
                className="mt-1 text-[17px] font-semibold text-[#f1f2f4]"
              >
                This address matches a known lookalike
              </h3>
            </div>

            <div className="px-5 py-4">
              <p className="text-[13px] leading-6 text-mute">
                {warning ??
                  "It shares the visible start and end of an address you have used before, which is how poisoning addresses get copied."}
              </p>

              {reference ? (
                <div className="mt-4">
                  <p className="label mb-1.5">Address from your history</p>
                  <code className="mono block break-all rounded-md border border-safe/30 bg-safe/[0.06] px-3 py-2 text-[12px] text-safe">
                    {reference}
                  </code>
                </div>
              ) : null}

              <div className="mt-3">
                <p className="label mb-1.5 text-danger">You are about to copy</p>
                <code className="mono block break-all rounded-md border border-danger/30 bg-danger/[0.06] px-3 py-2 text-[12px] text-danger">
                  {value}
                </code>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-line px-5 py-4 sm:flex-row">
              {reference ? (
                <button
                  type="button"
                  autoFocus
                  onClick={() => void copy(reference)}
                  className="btn-primary flex-1"
                >
                  Copy the verified address
                </button>
              ) : (
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirming(false)}
                  className="btn-primary flex-1"
                >
                  Go back
                </button>
              )}
              <button
                type="button"
                onClick={() => void copy(value)}
                className="btn-quiet flex-1 justify-center border border-line2"
              >
                Copy anyway
              </button>
            </div>

            <p className="border-t border-line px-5 py-3 text-[11px] leading-5 text-dim">
              Never send funds to {shortAddress(value)}. Confirm the full address
              with the recipient through a channel you trust.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
