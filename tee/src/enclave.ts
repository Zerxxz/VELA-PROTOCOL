/**
 * VELA enclave orchestrator.
 *
 * This is the code whose measurement (image hash) is attested by the GCP vTPM
 * quote and registered in VelaTeeRegistry. The flow inside the TEE:
 *
 *   1. Receive FDC-attested inputs for a subject (raw data is decrypted only
 *      inside the enclave).
 *   2. Project them into private CreditSignals.
 *   3. Compute the score + tier (deterministic, explainable).
 *   4. Commit to the inputs and sign the score with the enclave identity key.
 *   5. Export ONLY {score, tier, dataCommitment, signature} -- never raw data.
 */
import { Wallet } from "ethers";
import { computeScore, TIER_LABELS } from "./scoreModel";
import {
  computeDataCommitment,
  toCreditSignals,
  EnclaveRequest,
} from "./fdcInputs";
import {
  buildDomain,
  signAttestation,
  teeIdentity,
  ScoreAttestation,
} from "./attestation";

export interface EnclaveConfig {
  /** secp256k1 private key generated at enclave boot (kept in TEE memory). */
  enclaveKey: Wallet;
  chainId: number;
  registryAddress: string;
  /** seconds a score stays valid before it must be refreshed. */
  ttlSeconds: number;
}

export interface EnclaveResponse {
  attestation: ScoreAttestation;
  signature: string;
  tee: string;
  // explainability payload for the UI (derived from private data but non-reversible)
  explanation: {
    tierLabel: string;
    factors: Array<{ label: string; points: number; weightPct: number }>;
  };
}

export async function runEnclave(
  cfg: EnclaveConfig,
  req: EnclaveRequest,
  subjectNonce: number,
): Promise<EnclaveResponse> {
  // --- private section: raw data only exists here ---
  const signals = toCreditSignals(req);
  const { score, riskTier, factors } = computeScore(signals);
  const dataCommitment = computeDataCommitment(req.inputs);
  // --- end private section ---

  const now = Math.floor(Date.now() / 1000);
  const attestation: ScoreAttestation = {
    subject: req.subject,
    score,
    riskTier,
    dataCommitment,
    issuedAt: now,
    validUntil: now + cfg.ttlSeconds,
    nonce: subjectNonce,
  };

  const domain = buildDomain(cfg.chainId, cfg.registryAddress);
  const signature = await signAttestation(cfg.enclaveKey, domain, attestation);

  return {
    attestation,
    signature,
    tee: teeIdentity(cfg.enclaveKey),
    explanation: { tierLabel: TIER_LABELS[riskTier], factors },
  };
}
