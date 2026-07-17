/**
 * Ingests FDC (Flare Data Connector) attested inputs and turns them into the
 * private CreditSignals consumed by the scoring model.
 *
 * The point of using the FDC here is TRUSTLESS INPUTS + PRIVATE COMPUTE:
 *  - Each raw signal (an XRPL payment set, a bank statement fetched via
 *    Web2Json, a bureau score) arrives with an FDC Merkle proof, so we know it
 *    is authentic without trusting the user.
 *  - We compute a `dataCommitment` = keccak256 over the ordered attestation
 *    roots. That commitment is published on-chain with the score, letting an
 *    auditor verify *which* attested inputs produced a score, while the raw
 *    values stay sealed inside the enclave.
 */
import { keccak256, AbiCoder } from "ethers";
import type { CreditSignals } from "./scoreModel";

export interface FdcAttestedInput {
  /** Attestation type, e.g. "Payment", "Web2Json", "BalanceDecreasingTransaction". */
  attestationType: string;
  /** The FDC voting-round Merkle root this input was confirmed in. */
  votingRoundRoot: string; // bytes32 hex
  /** Decoded response body (kept private, never leaves the enclave). */
  responseBody: Record<string, unknown>;
}

export interface EnclaveRequest {
  subject: string; // borrower address
  inputs: FdcAttestedInput[];
}

/**
 * Deterministic commitment to the set of attested inputs. Order-independent by
 * sorting the roots first, so relayers cannot grief by reordering.
 */
export function computeDataCommitment(inputs: FdcAttestedInput[]): string {
  const roots = inputs.map((i) => i.votingRoundRoot.toLowerCase()).sort();
  return keccak256(AbiCoder.defaultAbiCoder().encode(["bytes32[]"], [roots]));
}

/**
 * Projects verified FDC inputs into the numeric signals the model needs.
 * In production each branch decodes a specific attestation response schema.
 */
export function toCreditSignals(req: EnclaveRequest): CreditSignals {
  const acc: CreditSignals = {
    assetsUsd: 0,
    liabilitiesUsd: 0,
    historyMonths: 0,
    onchainPayments: 0,
    liquidations: 0,
    monthlyInflowUsd: 0,
  };

  for (const input of req.inputs) {
    const b = input.responseBody as Record<string, number>;
    switch (input.attestationType) {
      case "Payment": // XRPL / BTC / DOGE payment observed via FDC
        acc.onchainPayments += 1;
        acc.monthlyInflowUsd += Number(b.valueUsd ?? 0) / 12;
        break;
      case "AddressBalance":
        acc.assetsUsd += Number(b.balanceUsd ?? 0);
        break;
      case "BalanceDecreasingTransaction": // liquidation / default signal
        acc.liquidations += 1;
        acc.liabilitiesUsd += Number(b.amountUsd ?? 0);
        break;
      case "Web2Json": // bank statement / bureau via Web2Json
        if (b.bureauScore) acc.bureauScore = Number(b.bureauScore);
        if (b.assetsUsd) acc.assetsUsd += Number(b.assetsUsd);
        if (b.liabilitiesUsd) acc.liabilitiesUsd += Number(b.liabilitiesUsd);
        if (b.monthlyInflowUsd)
          acc.monthlyInflowUsd += Number(b.monthlyInflowUsd);
        if (b.historyMonths)
          acc.historyMonths = Math.max(
            acc.historyMonths,
            Number(b.historyMonths),
          );
        break;
      default:
        // Unknown attestation types are ignored rather than trusted.
        break;
    }
  }
  return acc;
}
