/**
 * Signs a VELA score result with the enclave's TEE identity key using the exact
 * EIP-712 domain + typehash that VelaScoreRegistry / VelaAttestationLib verify
 * on-chain. The private key is generated at enclave boot and never leaves the
 * TEE; only the resulting signature is exported.
 *
 * Requires `ethers` v6 (see tee/package.json).
 */
import { Wallet, TypedDataDomain, TypedDataField } from "ethers";

export interface ScoreAttestation {
  subject: string;
  score: number; // uint16
  riskTier: number; // uint8
  dataCommitment: string; // bytes32
  issuedAt: number; // uint64 (unix seconds)
  validUntil: number; // uint64
  nonce: number; // uint256 (borrower nonce from the registry)
}

const TYPES: Record<string, TypedDataField[]> = {
  VelaScoreAttestation: [
    { name: "subject", type: "address" },
    { name: "score", type: "uint16" },
    { name: "riskTier", type: "uint8" },
    { name: "dataCommitment", type: "bytes32" },
    { name: "issuedAt", type: "uint64" },
    { name: "validUntil", type: "uint64" },
    { name: "nonce", type: "uint256" },
  ],
};

export function buildDomain(
  chainId: number,
  verifyingContract: string,
): TypedDataDomain {
  return { name: "VELA", version: "1", chainId, verifyingContract };
}

/**
 * @returns 65-byte hex signature accepted by VelaAttestationLib.recover.
 */
export async function signAttestation(
  enclaveKey: Wallet,
  domain: TypedDataDomain,
  attestation: ScoreAttestation,
): Promise<string> {
  return enclaveKey.signTypedData(domain, TYPES, attestation);
}

/** The EVM address that identifies this enclave on-chain (the TEE identity). */
export function teeIdentity(enclaveKey: Wallet): string {
  return enclaveKey.address;
}
