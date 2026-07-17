# VELA — Architecture

## 1. Trust model in one line

> **Trustless inputs (FDC) → private compute (TEE) → public proof (on-chain) → capital efficiency (FAssets + FTSOv2).**

Nobody — not the user, not the relayer, not the lender — has to be trusted. Data
authenticity is guaranteed by the FDC, computation integrity by the TEE
attestation, and result authenticity by an EIP-712 signature checked on-chain.

## 2. Components

### 2.1 FDC input layer (trustless data)
Each raw signal arrives with a Flare Data Connector Merkle proof:

| Signal | Attestation type | Source |
|---|---|---|
| Cross-chain balances | `AddressBalance` | XRPL, BTC |
| Payment history | `Payment` | XRP / BTC / DOGE |
| Defaults / liquidations | `BalanceDecreasingTransaction` | any supported chain |
| Bank statement / bureau score | `Web2Json` | arbitrary Web2 API |

The enclave verifies each proof's voting-round root, so a user cannot forge a
better financial profile.

### 2.2 Confidential Compute enclave (private compute)
Runs in a Flare Confidential Compute TEE (GCP Confidential Space, vTPM-attested).

1. Decrypts the FDC-attested inputs **only inside the enclave**.
2. Projects them into `CreditSignals` (`tee/src/fdcInputs.ts`).
3. Computes a deterministic, explainable score in `[0,1000]` and a risk tier
   `0..4` (`tee/src/scoreModel.ts`).
4. Computes `dataCommitment = keccak256(sorted attestation roots)`.
5. Signs an EIP-712 `VelaScoreAttestation` with the enclave's secp256k1 key.
6. Exports **only** `{score, riskTier, dataCommitment, issuedAt, validUntil,
   signature}`. Raw data is discarded.

The enclave's identity = the EVM address of its boot-generated key. Its code
measurement is attested by a GCP vTPM quote (verified on-chain by
`flare-vtpm-attestation`, relayed via the FDC) and registered in
`VelaTeeRegistry`.

### 2.3 On-chain layer (public proof)

**`VelaTeeRegistry`** — governance approves code measurements and registers /
revokes enclave identities. `isActiveTee()` is the single source of truth for
"is this signer a genuine, current VELA enclave?".

**`VelaScoreRegistry`** — `submitScore(attestation, signature)`:
- validates ranges, freshness (`validUntil`) and per-subject nonce (replay
  protection);
- reconstructs the EIP-712 digest via `VelaAttestationLib`;
- `ecrecover`s the signer and requires `teeRegistry.isActiveTee(signer)`;
- stores only the non-sensitive `Score` struct and emits `ScoreUpdated`.

Anyone can relay the transaction (subject, keeper, or enclave gateway) because
authenticity comes from the signature, not `msg.sender`.

**`VelaLendingPool`** — tier-based under-collateralized FXRP lending:

| Tier | Score | Label | Collateral factor |
|---|---|---|---|
| 4 | ≥850 | Prime | 60% |
| 3 | ≥700 | Strong | 80% |
| 2 | ≥550 | Fair | 100% |
| 1 | ≥400 | Subprime | 120% |
| 0 | <400 | High risk | 150% |

Uses FTSOv2 (`getFeedById(FXRP/USD)`) to price loans and collateral in USD.

## 3. Data-flow diagram

```
   XRPL / BTC / Web2
        │  (raw)
        ▼
  ┌───────────┐   Merkle proofs
  │    FDC     │ ─────────────────┐
  └───────────┘                   ▼
                          ┌────────────────────┐
   encrypted inputs  ───▶ │  TEE ENCLAVE       │  raw data never leaves
                          │  score + commit    │
                          │  EIP-712 sign      │
                          └─────────┬──────────┘
                                    │ {score,tier,commitment,sig}
                                    ▼
   ┌────────────────┐   verify   ┌────────────────────┐
   │ VelaTeeRegistry│ ◀───────── │ VelaScoreRegistry   │
   └────────────────┘            └─────────┬──────────┘
                                           │ scoreOf / tier
                            FTSOv2 price   ▼
                          ┌────────────────────────────┐
                          │ VelaLendingPool (FXRP)      │
                          └────────────────────────────┘
```

## 4. Threat model & mitigations

| Threat | Mitigation |
|---|---|
| User forges financial data | All inputs FDC Merkle-proven |
| Fake / rogue enclave | vTPM code-measurement approval + `VelaTeeRegistry` |
| Signature replay | per-subject nonce + `validUntil` expiry |
| Signature malleability | high-s rejection (EIP-2) in `VelaAttestationLib` |
| Compromised enclave build | governance `revokeTee` + measurement de-approval |
| Stale price / score | FTSOv2 freshness + score `validUntil` check |
| Relayer griefing (input reorder) | order-independent `dataCommitment` |

## 5. Production hardening (post-hackathon)
- On-chain vTPM quote verification wired directly into `registerTee`.
- Interest accrual, partial repayment, and liquidation auctions in the pool.
- ZK proof of the scoring computation as an optional complement to the TEE.
- Score portability across Flare dApps via the `IVelaScoreRegistry` interface.
