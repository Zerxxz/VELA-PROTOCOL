# VELA — Confidential Credit & Reputation Layer on Flare

> **Prove you're creditworthy. Reveal nothing.**
>
> A TEE computes your credit score over private, cross-chain data. The chain
> sees only the signed result — which unlocks **under-collateralized FXRP loans**.

Built for the **Flare Summer Signal** hackathon. VELA composes *every* Flare
pillar into one product and targets **both** bounties:

- 🧠 **Confidential Compute** — scoring runs inside a Flare Confidential Compute
  enclave (TEE); the enclave identity is registered on-chain via vTPM
  attestation + FDC.
- 🔎 **FDC** — every scoring input (XRPL/BTC payments, balances, Web2 bank/bureau
  data) is Merkle-proven before it counts.
- 📈 **FTSOv2** — live FXRP/USD feeds value collateral and loans in real time.
- 🌊 **FAssets** — FXRP is the borrowable asset, putting real XRP liquidity to
  work in Flare DeFi.

---

## Why it wins

DeFi is stuck at 150% collateral because nobody can prove creditworthiness
without doxxing their finances on a public chain. VELA breaks that trade-off:
your sensitive data stays sealed in a TEE, and only a **verifiable score** and a
**commitment to the (attested) inputs** ever touch the chain. A prime borrower
posts as little as **60%** collateral instead of 150%.

## Repository layout

```
vela/
├── contracts/            Solidity (0.8.25)
│   ├── VelaTeeRegistry.sol      trusted enclave identity registry
│   ├── VelaScoreRegistry.sol    verifies TEE signatures, stores scores
│   ├── VelaLendingPool.sol      tier-based under-collateralized FXRP lending
│   ├── lib/VelaAttestationLib.sol  EIP-712 hashing + safe ECDSA recovery
│   ├── interfaces/                 IVelaScoreRegistry, IVelaTeeRegistry
│   └── mocks/                      MockFTSOv2, MockFXRP, FTSO consumer doc
├── tee/                  Confidential Compute enclave (TypeScript)
│   ├── src/scoreModel.ts        deterministic, explainable scoring model
│   ├── src/fdcInputs.ts         FDC-attested inputs -> signals + commitment
│   ├── src/attestation.ts       EIP-712 signing with the enclave key
│   ├── src/enclave.ts           orchestrator (private section)
│   ├── src/server.ts            local gateway (POST /score)
│   └── test/scoreModel.test.ts  dependency-free unit tests
├── scripts/              deploy.ts · registerTee.ts · demoFlow.ts
├── test/                 vela.test.ts (Hardhat + ethers)
├── demo/index.html       self-contained interactive product demo
├── hardhat.config.ts     Coston2 (114) + Flare (14)
├── ARCHITECTURE.md       full technical design
└── PITCH.md              judge-facing pitch
```

## Quick start

### 1. Smart contracts
```bash
npm install
npm run build          # hardhat compile
npm test               # runs test/vela.test.ts
npm run demo           # end-to-end local flow (deploy -> score -> borrow)
```

### 2. Confidential Compute enclave
```bash
cd tee && npm install
npm test               # scoring model sanity tests (no secrets needed)
npm start              # prints the enclave TEE identity + serves POST /score
```

### 3. Deploy to Coston2 testnet
```bash
cp .env.example .env   # add PRIVATE_KEY, get C2FLR from faucet.flare.network
npm run deploy:coston2
# start the enclave, note its identity address, then:
TEE_REGISTRY=0x.. TEE_IDENTITY=0x.. npm run register-tee:coston2
```

### 4. Try the demo
Open `demo/index.html` in any browser — move the sliders and watch the score,
tier and required collateral update while the private inputs stay in the enclave
panel.

## Network config (Coston2)

| | |
|---|---|
| RPC | `https://coston2-api.flare.network/ext/C/rpc` |
| Chain ID | `114` |
| Currency | `C2FLR` |
| Faucet | `https://faucet.flare.network` |
| Explorer | `https://coston2-explorer.flare.network` |

## Security notes

- ECDSA recovery rejects malleable (high-s) signatures and `v ∉ {27,28}`.
- Replay protection via a per-subject nonce in `VelaScoreRegistry`.
- Scores expire (`validUntil`); the lending pool refuses stale scores.
- The TEE registry supports code-measurement approval + revocation so a
  compromised enclave build can be disabled by governance.
- On mainnet, replace the mock FTSOv2/FXRP with `ContractRegistry.getFtsoV2()`
  and the real FAssets FXRP address (see `contracts/mocks/FtsoV2FeedConsumer.sol`).

## License
MIT
