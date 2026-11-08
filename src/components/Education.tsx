const STEPS = [
  {
    number: "01",
    title: "Attacker reads the chain",
    body: "It sees an address you already pay and grinds a new keypair whose address starts and ends the same way.",
  },
  {
    number: "02",
    title: "Dust enters your history",
    body: "A tiny transfer from the fake address lands beside the real one, so both rows look identical when shortened.",
  },
  {
    number: "03",
    title: "You copy the wrong row",
    body: "You paste from history and glance at the first and last characters. The full address is different. The funds are gone.",
  },
];

export function Education() {
  return (
    <section className="mt-8 border-t border-line pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-[#d8dbe0]">
          How address poisoning works
        </h2>
        <span className="mono text-[10.5px] text-dim">
          32 bytes rendered as 43–44 base58 characters
        </span>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.number}>
            <span className="mono text-[10.5px] text-dim">{step.number}</span>
            <h3 className="mt-1.5 text-[12.5px] font-semibold text-[#d8dbe0]">
              {step.title}
            </h3>
            <p className="mt-1 text-[11.5px] leading-5 text-mute">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-md border border-line">
        <div className="grid md:grid-cols-2">
          <div className="border-b border-line p-3 md:border-b-0 md:border-r">
            <p className="label mb-1.5 text-safe">The address you meant to pay</p>
            <code className="mono block break-all text-[12px] leading-[1.75] text-[#c6ccd4]">
              7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosg
              <span className="bg-safe/20 font-semibold text-safe">9AsU</span>
            </code>
            <p className="mono mt-2 text-[10.5px] text-dim">
              14 interactions · first seen 3 months ago
            </p>
          </div>
          <div className="p-3">
            <p className="label mb-1.5 text-danger">The poisoned twin</p>
            <code className="mono block break-all text-[12px] leading-[1.75] text-[#c6ccd4]">
              7xKX
              <span className="bg-danger/20 font-semibold text-danger">
                mQ4vR8pL2wZcN6yB
              </span>
              hTqA83TZRuJosg
              <span className="bg-safe/20 font-semibold text-safe">9AsU</span>
            </code>
            <p className="mono mt-2 text-[10.5px] text-dim">
              0 sent · 0.000001 SOL received · dust only
            </p>
          </div>
        </div>
        <p className="border-t border-line px-3 py-2 text-[11px] text-dim">
          The visible ends match. The wallet does not. Checking four characters is not
          a check.
        </p>
      </div>
    </section>
  );
}
