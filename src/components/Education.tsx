const STEPS = [
  {
    number: "01",
    title: "Attackers watch the chain",
    body: "They see an address you have paid before and generate a brand-new keypair whose address starts and ends with the same characters.",
  },
  {
    number: "02",
    title: "They send you dust",
    body: "A tiny transfer from the fake address lands in your history, so it now appears next to the real one in your wallet.",
  },
  {
    number: "03",
    title: "You copy the wrong row",
    body: "Later you copy from history, paste it, and only glance at the first four and last four characters. The money is gone.",
  },
];

export function Education() {
  return (
    <section id="how-it-works" className="mt-14">
      <div className="mb-6">
        <p className="label mb-2">How the attack works</p>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Address poisoning, in three steps
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-mute">
          A Solana address is a 32-byte public key shown as 43–44 base58
          characters. Wallets shorten it to <code className="mono text-slate-300">7xKX…9AsU</code>, and that
          shortening is exactly what the attacker exploits.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.number} className="card p-5">
            <span className="mono text-xs font-bold text-sol">{step.number}</span>
            <h3 className="mt-3 text-base font-semibold text-white">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-mute">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="card mt-4 overflow-hidden">
        <div className="grid gap-0 md:grid-cols-2">
          <div className="border-b border-line p-5 md:border-b-0 md:border-r">
            <p className="label mb-2 text-safe">The address you meant to pay</p>
            <code className="mono break-all text-sm leading-6 text-slate-200">
              7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosg<span className="rounded bg-safe/15 font-bold text-safe">9AsU</span>
            </code>
            <p className="mt-3 text-xs text-mute">
              14 successful interactions · first seen 3 months ago
            </p>
          </div>
          <div className="p-5">
            <p className="label mb-2 text-danger">The poisoned lookalike</p>
            <code className="mono break-all text-sm leading-6 text-slate-200">
              7xKX<span className="rounded bg-danger/20 px-0.5 font-bold text-danger">mQ4vR8pL2wZcN6yB</span>hTqA83TZRuJosg<span className="rounded bg-safe/15 font-bold text-safe">9AsU</span>
            </code>
            <p className="mt-3 text-xs text-mute">
              0 interactions · arrived as a 0.000001 SOL dust transfer
            </p>
          </div>
        </div>
        <div className="border-t border-line bg-white/[0.02] px-5 py-3 text-xs text-mute">
          Identical first four and last four characters. Completely different
          wallet. This is why “I checked the start and end” is not enough.
        </div>
      </div>
    </section>
  );
}
