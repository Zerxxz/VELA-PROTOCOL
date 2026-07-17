import { ethers } from "hardhat";

/**
 * Registers a running enclave's TEE identity in VelaTeeRegistry.
 * The enclave prints its identity address on boot (see tee/src/server.ts).
 *
 * Usage: TEE_REGISTRY=0x.. TEE_IDENTITY=0x.. npm run register-tee:coston2
 */
async function main() {
  const registryAddr = req("TEE_REGISTRY");
  const teeIdentity = req("TEE_IDENTITY");
  const measurement =
    process.env.ENCLAVE_CODE_MEASUREMENT ??
    "0x0000000000000000000000000000000000000000000000000000000000000001";
  const expiresAt = Number(process.env.TEE_EXPIRES_AT ?? 0);

  const registry = await ethers.getContractAt("VelaTeeRegistry", registryAddr);

  if (!(await registry.isApprovedMeasurement(measurement))) {
    console.log("Approving code measurement...");
    await (await registry.setMeasurementApproval(measurement, true)).wait();
  }
  console.log(`Registering TEE ${teeIdentity} ...`);
  await (
    await registry.registerTee(teeIdentity, measurement, expiresAt)
  ).wait();
  console.log(`Active: ${await registry.isActiveTee(teeIdentity)}`);
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
