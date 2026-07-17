import { ethers, network } from "hardhat";

/**
 * Deploys the full VELA stack to the selected network (default: Coston2).
 *   VelaTeeRegistry -> VelaScoreRegistry -> (Mock)FXRP + (Mock)FTSOv2 -> VelaLendingPool
 *
 * On Coston2/Flare, replace the mock FTSOv2 with ContractRegistry.getFtsoV2()
 * and the mock FXRP with the real FAssets FXRP address.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address} on ${network.name}`);

  const codeMeasurement =
    process.env.ENCLAVE_CODE_MEASUREMENT ??
    "0x0000000000000000000000000000000000000000000000000000000000000001";
  const fxrpUsdFeedId =
    process.env.FXRP_USD_FEED_ID ??
    "0x015852502f55534400000000000000000000000000";

  const TeeRegistry = await ethers.getContractFactory("VelaTeeRegistry");
  const teeRegistry = await TeeRegistry.deploy(deployer.address);
  await teeRegistry.waitForDeployment();
  console.log(`VelaTeeRegistry:   ${await teeRegistry.getAddress()}`);

  await (
    await teeRegistry.setMeasurementApproval(codeMeasurement, true)
  ).wait();

  const ScoreRegistry = await ethers.getContractFactory("VelaScoreRegistry");
  const scoreRegistry = await ScoreRegistry.deploy(
    await teeRegistry.getAddress(),
  );
  await scoreRegistry.waitForDeployment();
  console.log(`VelaScoreRegistry: ${await scoreRegistry.getAddress()}`);

  // --- FXRP + FTSOv2: use mocks on hardhat, real addresses on Flare ---
  let fxrpAddress = process.env.FXRP_ADDRESS ?? "";
  let ftsoAddress = process.env.FTSO_V2_ADDRESS ?? "";

  if (network.name === "hardhat" || !fxrpAddress) {
    const FXRP = await ethers.getContractFactory("MockFXRP");
    const fxrp = await FXRP.deploy();
    await fxrp.waitForDeployment();
    fxrpAddress = await fxrp.getAddress();
    console.log(`MockFXRP:          ${fxrpAddress}`);
  }
  if (network.name === "hardhat" || !ftsoAddress) {
    const Ftso = await ethers.getContractFactory("MockFtsoV2");
    // XRP ~ $2.10, 5 implied decimals
    const ftso = await Ftso.deploy(210000n, 5);
    await ftso.waitForDeployment();
    ftsoAddress = await ftso.getAddress();
    console.log(`MockFtsoV2:        ${ftsoAddress}`);
  }

  const LendingPool = await ethers.getContractFactory("VelaLendingPool");
  const pool = await LendingPool.deploy(
    await scoreRegistry.getAddress(),
    ftsoAddress,
    fxrpAddress,
    fxrpUsdFeedId,
    deployer.address,
  );
  await pool.waitForDeployment();
  console.log(`VelaLendingPool:   ${await pool.getAddress()}`);

  console.log("\nDeployment complete. Copy these into your .env file.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
