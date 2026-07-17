# VELA — Judge Pitch

## The one-liner
**VELA lets anyone prove they're creditworthy without revealing a single number — and turns that private proof into under-collateralized FXRP loans on Flare.**

## The problem (why judges should care)
DeFi lending is stuck at **150%+ collateral**. Why? Because on a public chain
there's no way to prove you're a good borrower without exposing your entire
financial life. So every borrower — prime or anonymous — posts the same crippling
collateral. Billions in capital sit idle. Real-world credit never arrives
on-chain.

## The insight
Flare is the only L1 that ships **all four** primitives you need to fix this,
natively:
- **FDC** to make off/cross-chain data *trustless*,
- **Confidential Compute (TEE)** to make the computation *private*,
- **FTSOv2** to price assets *live*,
- **FAssets (FXRP)** to move *real XRP liquidity*.

No other chain can do this without external oracles, bridges and trusted
servers. VELA is a Flare-native product, not a port.

## What we built
1. A **Confidential Compute enclave** that ingests FDC-attested data, computes an
   explainable credit score entirely in a TEE, and signs the result. Raw data
   never leaves the enclave.
2. **Three audited-style smart contracts** — a TEE identity registry, a score
   registry that verifies enclave signatures on-chain, and a lending pool that
   turns your tier into cheaper collateral.
3. A **polished interactive demo** where you move sliders of private data and
   watch the on-chain score, tier and required collateral update — while the raw
   inputs visibly stay inside the enclave.

## The "wow" moment
Drag the sliders. Your assets, salary and history change the score in real
time — but the blockchain panel only ever shows a number, a tier, and a hash.
**Prime borrowers unlock 100 FXRP with just 60 FXRP locked instead of 150.**
That's a 60% capital-efficiency gain, powered entirely by privacy-preserving
proof.

## Traction of the idea
- Hits **both** hackathon bounties (Confidential Compute *and* Interoperable
  Assets) with a single coherent product.
- Every component is real and testable today (unit tests + local end-to-end
  flow + Coston2 deploy scripts included).
- Clear path to production: real vTPM verification, interest/liquidations, and
  score portability across the Flare DeFi ecosystem.

## Ask
VELA is the missing **credit primitive** for XRPFi. With it, Flare becomes the
first chain where your real financial reputation — private, portable, provable —
finally counts.
