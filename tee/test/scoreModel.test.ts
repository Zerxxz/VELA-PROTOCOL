/**
 * Dependency-free sanity tests for the VELA scoring model.
 * Run with:  npx tsx tee/test/scoreModel.test.ts
 */
import {
  computeScore,
  tierFromScore,
  TIER_LABELS,
  CreditSignals,
} from "../src/scoreModel";

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log("  \u2713 " + msg);
  } else {
    failed++;
    console.error("  \u2717 " + msg);
  }
}

const prime: CreditSignals = {
  assetsUsd: 120000,
  liabilitiesUsd: 5000,
  historyMonths: 60,
  onchainPayments: 320,
  liquidations: 0,
  monthlyInflowUsd: 12000,
  bureauScore: 810,
};

const risky: CreditSignals = {
  assetsUsd: 800,
  liabilitiesUsd: 3000,
  historyMonths: 2,
  onchainPayments: 3,
  liquidations: 4,
  monthlyInflowUsd: 200,
  bureauScore: 420,
};

console.log("VELA scoreModel tests");

const p = computeScore(prime);
const r = computeScore(risky);

assert(p.score >= 0 && p.score <= 1000, `prime score in range (${p.score})`);
assert(r.score >= 0 && r.score <= 1000, `risky score in range (${r.score})`);
assert(
  p.score > r.score,
  `prime (${p.score}) scores higher than risky (${r.score})`,
);
assert(
  p.riskTier >= 3,
  `prime lands in a strong tier (${TIER_LABELS[p.riskTier]})`,
);
assert(
  r.riskTier <= 1,
  `risky lands in a weak tier (${TIER_LABELS[r.riskTier]})`,
);
assert(
  p.factors.reduce((a, f) => a + f.weightPct, 0) === 100,
  "factor weights sum to 100%",
);
assert(
  tierFromScore(1000) === 4 && tierFromScore(0) === 0,
  "tier bounds correct",
);

// determinism
assert(
  JSON.stringify(computeScore(prime)) === JSON.stringify(p),
  "scoring is deterministic",
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
