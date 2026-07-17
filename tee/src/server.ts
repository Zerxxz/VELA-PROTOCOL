/**
 * Minimal HTTP gateway that runs *outside* trust but forwards requests into the
 * enclave. Uses only Node's built-in http module (no extra deps) so it is easy
 * to audit. In a real Confidential Space deployment this handler executes
 * inside the TEE image.
 *
 *   POST /score  { subject, inputs: FdcAttestedInput[], nonce }
 *   -> { attestation, signature, tee, explanation }
 *
 * Run:  npx tsx tee/src/server.ts   (after `npm i` in tee/)
 */
import { createServer } from "node:http";
import { Wallet } from "ethers";
import { runEnclave, EnclaveConfig } from "./enclave";
import { EnclaveRequest } from "./fdcInputs";

const PORT = Number(process.env.PORT ?? 8787);

// In production the key is sealed by the TEE; here it comes from env for local dev.
const enclaveKey = process.env.ENCLAVE_PRIVATE_KEY
  ? new Wallet(process.env.ENCLAVE_PRIVATE_KEY)
  : Wallet.createRandom();

const cfg: EnclaveConfig = {
  enclaveKey,
  chainId: Number(process.env.CHAIN_ID ?? 114), // Coston2
  registryAddress:
    process.env.SCORE_REGISTRY ?? "0x0000000000000000000000000000000000000000",
  ttlSeconds: Number(process.env.SCORE_TTL ?? 7 * 24 * 3600),
};

console.log(
  `VELA enclave identity (register this in VelaTeeRegistry): ${enclaveKey.address}`,
);

const server = createServer((httpReq, res) => {
  if (httpReq.method !== "POST" || httpReq.url !== "/score") {
    res.writeHead(404).end(JSON.stringify({ error: "not found" }));
    return;
  }
  let body = "";
  httpReq.on("data", (c) => (body += c));
  httpReq.on("end", async () => {
    try {
      const parsed = JSON.parse(body) as EnclaveRequest & { nonce: number };
      const out = await runEnclave(
        cfg,
        { subject: parsed.subject, inputs: parsed.inputs },
        parsed.nonce ?? 0,
      );
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
  });
});

server.listen(PORT, () =>
  console.log(`VELA enclave gateway listening on :${PORT}`),
);
