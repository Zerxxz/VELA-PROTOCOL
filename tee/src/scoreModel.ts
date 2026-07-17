/**
 * VELA confidential scoring model.
 *
 * This module runs *inside* a Flare Confidential Compute enclave (a TEE). The
 * raw financial signals passed in here NEVER leave the enclave -- only the
 * derived score, tier and a commitment to the inputs are ever exported and
 * signed. The model is intentionally pure and deterministic so that:
 *   1. the same inputs always yield the same score (auditable), and
 *   2. it can be unit-tested outside the enclave without any secrets.
 */

export interface CreditSignals {
  /** Total verifiable on/cross-chain assets in USD (via FDC + FTSOv2). */
  assetsUsd: number;
  /** Total outstanding liabilities/borrowings in USD. */
  liabilitiesUsd: number;
  /** Age of the oldest wallet / account in months. */
  historyMonths: number;
  /** Count of successful cross-chain payments observed via FDC. */
  onchainPayments: number;
  /** Count of liquidations or defaults in the borrower's history. */
  liquidations: number;
  /** Average monthly inflow in USD (income proxy, FDC-attested). */
  monthlyInflowUsd: number;
  /** Optional off-chain credit bureau score, 300..850 (FDC Web2Json). */
  bureauScore?: number;
}

export interface ScoreResult {
  /** VELA score in [0, 1000]. */
  score: number;
  /** Risk tier 0 (highest risk) .. 4 (prime). */
  riskTier: number;
  /** Human-readable factor breakdown for explainability (stays in enclave/UI). */
  factors: Array<{ label: string; points: number; weightPct: number }>;
}

const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));

/**
 * Weighted, explainable scoring. Weights sum to 100%.
 * Every sub-score is normalized to [0, 1] before weighting.
 */
export function computeScore(s: CreditSignals): ScoreResult {
  // 1. Solvency: net worth relative to liabilities (35%).
  const netWorth = s.assetsUsd - s.liabilitiesUsd;
  const leverage =
    s.liabilitiesUsd <= 0
      ? 1
      : clamp(netWorth / Math.max(s.assetsUsd, 1), 0, 1);
  const solvency = clamp(
    0.5 * leverage + 0.5 * clamp(netWorth / 50000, 0, 1),
    0,
    1,
  );

  // 2. History depth (15%).
  const history = clamp(s.historyMonths / 48, 0, 1);

  // 3. On-chain repayment behaviour (20%).
  const activity = clamp(s.onchainPayments / 200, 0, 1);
  const penalty = clamp(s.liquidations * 0.25, 0, 1);
  const behaviour = clamp(activity - penalty, 0, 1);

  // 4. Cash-flow / income stability (15%).
  const cashflow = clamp(s.monthlyInflowUsd / 8000, 0, 1);

  // 5. External bureau signal, if available (15%).
  const bureau = s.bureauScore
    ? clamp((s.bureauScore - 300) / (850 - 300), 0, 1)
    : 0.5;

  const weighted = [
    { label: "Solvency & net worth", value: solvency, weightPct: 35 },
    { label: "Credit history depth", value: history, weightPct: 15 },
    { label: "On-chain repayment behaviour", value: behaviour, weightPct: 20 },
    { label: "Cash-flow stability", value: cashflow, weightPct: 15 },
    { label: "External bureau signal", value: bureau, weightPct: 15 },
  ];

  const score = Math.round(
    weighted.reduce((acc, f) => acc + f.value * f.weightPct, 0) * 10,
  ); // *10 -> [0,1000]

  const factors = weighted.map((f) => ({
    label: f.label,
    points: Math.round(f.value * f.weightPct * 10),
    weightPct: f.weightPct,
  }));

  return {
    score: clamp(score, 0, 1000),
    riskTier: tierFromScore(score),
    factors,
  };
}

/** Maps a [0,1000] score to a 0..4 risk tier used by the lending pool. */
export function tierFromScore(score: number): number {
  if (score >= 850) return 4; // prime      -> 60% collateral
  if (score >= 700) return 3; // strong     -> 80%
  if (score >= 550) return 2; // fair       -> 100%
  if (score >= 400) return 1; // subprime   -> 120%
  return 0; //                    high risk  -> 150%
}

export const TIER_LABELS = ["High risk", "Subprime", "Fair", "Strong", "Prime"];
