# Solana Shield — Submission & Video Pitch Kit

## 1. Quick Links for Devpost
- **Live Demo:** [https://solana-shield.vercel.app](https://solana-shield.vercel.app)
- **GitHub Repository:** [https://github.com/AdewuyiDaniels/solana-shield](https://github.com/AdewuyiDaniels/solana-shield)

---

## 2. Devpost Submission Copy (Copy & Paste)

### Project Title
**Solana Shield — Defensible Address Poisoning Interceptor & Lookalike Detector**

### Elevator Pitch (Tagline)
Zero-dependency, client-side pre-flight address audit that catches vanity poisoning attacks using 4+4 anchor math and on-demand dust-fanout reputation scoring before funds are lost.

### The Problem
Solana addresses are 32–44 characters long in base58. Wallet interfaces only display the first 4 and last 4 characters (e.g., `7xKX...9qZ2`). Attackers exploit this human visual truncation by generating vanity addresses matching your real counterparty's 4-character prefix and suffix, then sending tiny amounts of dust (0.000001 SOL) into your wallet. The next time you copy an address from your transaction history, you copy the poisoned lookalike. Millions of dollars in crypto have been lost to this attack.

### What it does
Solana Shield performs a client-side safety audit before you transfer funds:
1. **4+4 Anchor Collision Math:** Compares your destination address against your actual wallet interaction history. If an address matches the visible prefix and suffix (4+4) but differs in the middle, it triggers an instant `HIGH-RISK` warning.
2. **On-Demand Public Behavior Scoring (Global Poisoner Signal):** Even for unknown addresses that never interacted with your wallet, Solana Shield queries public RPC on-the-fly (last 100 signatures) to evaluate the address’s behavior: high-velocity dust fan-out to distinct recipients with zero inbound transfers immediately raises the threat score.
3. **Guarded Copy Interception:** A guarded clipboard modal detects when you try to copy a lookalike and automatically presents the *verified* counterparty address instead.
4. **History Audit:** Automatically analyzes your wallet history to identify active dust poisoning attempts that already landed in your recent transactions.

### How we built it
- **Framework:** Next.js 14 (App Router), Tailwind CSS, Lucide Icons.
- **Web3 Integration:** `@solana/web3.js` with pure client-side concurrent signature streaming & parsed transaction classification (no custom backend or server keys needed).
- **Security Engineering:** Custom prefix/suffix Levenshtein & anchor divergence algorithms, zero external analytics, zero tracking, zero key access.

### Challenges we ran into
RPC rate limits and network latency when inspecting transaction deltas. We solved this with an adaptive concurrency pool (`mapWithConcurrency`), client-side session caching, and falling back to resilient public RPC nodes without ever requiring users to provide an API key.

### Accomplishments that we're proud of
- Completely client-side: Private keys and wallet data never touch a backend server.
- Mathematical rigor over vague "AI heuristics": Clear, deterministic 4+4 visual anchor collision proofs that any judge or engineer can independently verify.
- Live, tested on Mainnet and Devnet with 100% test pass rate across 38 unit and integration tests.

---

## 3. Video Demo Script (75 Seconds)

**Target length:** 70–80 seconds  
**Resolution:** 1080p60 (OBS / Xbox Game Bar)  
**Browser setup:** Chrome/Edge at 110% zoom, bookmarks bar hidden, single tab at [https://solana-shield.vercel.app](https://solana-shield.vercel.app).

| Time | Visual / Action on Screen | Voiceover Script |
|---|---|---|
| **0:00–0:10** | Open site in **Sample Mode**. Point mouse to the comparison: `Real address` vs `Poisoned lookalike`. | *"Solana wallets truncate addresses to 4 prefix and 4 suffix characters. Attackers exploit this by sending dust from lookalike addresses that match both ends."* |
| **0:10–0:24** | Click **Poisoned lookalike** link. Click **Check**. Red `HIGH-RISK` card appears. | *"Here’s a poisoned twin. To your eyes, it looks identical. But Solana Shield computes the 4+4 anchor math, flags the divergence in the middle characters, and warns you instantly."* |
| **0:24–0:38** | Click **Copy (guarded)** button. Interception modal pops up. | *"Watch what happens when I try to copy it. Guarded copy intercepts the clipboard and hands me the real counterparty address instead of the attacker's trap."* |
| **0:38–0:52** | Paste an unassociated address. Watch the on-demand reputation scan run live. | *"What if an address has never touched your wallet? Solana Shield inspects its public ledger history on-demand. If it exhibits a dust fan-out signature to dozens of wallets, it gets flagged on the spot."* |
| **0:52–1:06** | Switch to **Live Mode**, connect Phantom wallet, click **Rescan**. Green progress bar fills. | *"In Live Mode, it connects to Phantom or any Solana wallet, parses recent transactions directly from the public RPC in the browser, and audits your entire counterparty graph."* |
| **1:06–1:15** | Scroll down to the **History Audit Alert** showing the detected poisoning twins. | *"It even shows past poisoning attacks that already landed in your wallet. Zero backend, zero tracking, mathematical safety."* |
| **1:15–1:20** | Show title banner, GitHub link, and URL. | *"Solana Shield. Protect your transfers before you sign. Try it live at solana-shield.vercel.app."* |

---

## 4. Final Submission Checklist

- [x] **Git Repository Pushed:** [https://github.com/AdewuyiDaniels/solana-shield](https://github.com/AdewuyiDaniels/solana-shield)
- [x] **Vercel Production Deployed:** [https://solana-shield.vercel.app](https://solana-shield.vercel.app)
- [x] **Reputation & Dust Fan-out Engine:** Live in production (`src/lib/reputation.ts`)
- [ ] **Record the 75s Demo Video:** Using the script above, record 1 clean take (plus 1 backup take) and upload to YouTube (unlisted or public).
- [ ] **Submit on Devpost:** Fill out the Devpost fields using Section 2 above, attach the YouTube video link and GitHub repo.

