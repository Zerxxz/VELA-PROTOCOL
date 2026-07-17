import { ethers } from "hardhat";

/**
 * End-to-end local demo: deploy -> register enclave -> sign score -> submit ->
 * borrow under-collateralized FXRP. Run: npm run demo
 */
async function main() {
  const [gov, enclave, borrower, lp] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const MEASUREMENT = "0x" + "11".repeat(32);
  const FXRP_USD = "0x015852502f55534400000000000000000000000000";

  const teeReg = await (
    await ethers.getContractFactory("VelaTeeRegistry")
  ).deploy(gov.address);
  await teeReg.setMeasurementApproval(MEASUREMENT, true);
  await teeReg.registerTee(enclave.address, MEASUREMENT, 0);

  const scoreReg = await (
    await ethers.getContractFactory("VelaScoreRegistry")
  ).deploy(await teeReg.getAddress());

  const now = (await ethers.provider.getBlock("latest"))!.timestamp;
  const att = {
    subject: borrower.address,
    score: 902,
    riskTier: 4,
    dataCommitment: ethers.keccak256(ethers.toUtf8Bytes("fdc-inputs")),
    issuedAt: now,
    validUntil: now + 7 * 24 * 3600,
    nonce: 0,
  };
  const domain = {
    name: "VELA",
    version: "1",
    chainId,
    verifyingContract: await scoreReg.getAddress(),
  };
  const types = {
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
  const sig = await enclave.signTypedData(domain, types, att);
  await scoreReg.submitScore(att, sig);
  console.log(
    `Score stored for ${borrower.address}: ${att.score} (tier ${att.riskTier})`,
  );

  const fxrp = await (await ethers.getContractFactory("MockFXRP")).deploy();
  const ftso = await (
    await ethers.getContractFactory("MockFtsoV2")
  ).deploy(210000n, 5);
  const pool = await (
    await ethers.getContractFactory("VelaLendingPool")
  ).deploy(
    await scoreReg.getAddress(),
    await ftso.getAddress(),
    await fxrp.getAddress(),
    FXRP_USD,
    gov.address,
  );

  const liq = ethers.parseEther("1000");
  await fxrp.mint(lp.address, liq);
  await fxrp.connect(lp).approve(await pool.getAddress(), liq);
  await pool.connect(lp).addLiquidity(liq);

  const principal = ethers.parseEther("100");
  const required = await pool.requiredCollateral(borrower.address, principal);
  console.log(
    `Borrow 100 FXRP -> required collateral: ${ethers.formatEther(required)} FXRP (prime = 60%)`,
  );

  await fxrp.mint(borrower.address, required);
  await fxrp.connect(borrower).approve(await pool.getAddress(), required);
  await pool.connect(borrower).borrow(principal, required);
  console.log(
    "Loan opened. VELA turned a private score into real capital efficiency.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
