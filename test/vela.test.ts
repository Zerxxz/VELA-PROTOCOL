import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const MEASUREMENT = "0x" + "11".repeat(32);
const FXRP_USD = "0x015852502f55534400000000000000000000000000";

async function signScore(
  enclave: HardhatEthersSigner,
  registryAddr: string,
  chainId: bigint,
  a: {
    subject: string;
    score: number;
    riskTier: number;
    dataCommitment: string;
    issuedAt: number;
    validUntil: number;
    nonce: number;
  },
) {
  const domain = {
    name: "VELA",
    version: "1",
    chainId,
    verifyingContract: registryAddr,
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
  return enclave.signTypedData(domain, types, a);
}

describe("VELA", () => {
  it("stores a score signed by a registered TEE and gates borrowing by tier", async () => {
    const [gov, enclave, borrower, lp] = await ethers.getSigners();
    const chainId = (await ethers.provider.getNetwork()).chainId;

    const teeReg = await (
      await ethers.getContractFactory("VelaTeeRegistry")
    ).deploy(gov.address);
    await teeReg.setMeasurementApproval(MEASUREMENT, true);
    await teeReg.registerTee(enclave.address, MEASUREMENT, 0);
    expect(await teeReg.isActiveTee(enclave.address)).to.equal(true);

    const scoreReg = await (
      await ethers.getContractFactory("VelaScoreRegistry")
    ).deploy(await teeReg.getAddress());

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const att = {
      subject: borrower.address,
      score: 880,
      riskTier: 4,
      dataCommitment: "0x" + "ab".repeat(32),
      issuedAt: now,
      validUntil: now + 3600,
      nonce: 0,
    };
    const sig = await signScore(
      enclave,
      await scoreReg.getAddress(),
      chainId,
      att,
    );
    await scoreReg.submitScore(att, sig);

    const stored = await scoreReg.scoreOf(borrower.address);
    expect(stored.score).to.equal(880);
    expect(stored.riskTier).to.equal(4);
    expect(await scoreReg.hasFreshScore(borrower.address)).to.equal(true);

    // reject a forged signature from an unregistered signer
    const forged = await signScore(
      borrower,
      await scoreReg.getAddress(),
      chainId,
      { ...att, nonce: 1 },
    );
    await expect(
      scoreReg.submitScore({ ...att, nonce: 1 }, forged),
    ).to.be.revertedWithCustomError(scoreReg, "InactiveTee");

    // lending: prime tier (4) => 60% collateral
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

    const oneK = ethers.parseEther("1000");
    await fxrp.mint(lp.address, oneK);
    await fxrp.connect(lp).approve(await pool.getAddress(), oneK);
    await pool.connect(lp).addLiquidity(oneK);

    const principal = ethers.parseEther("100");
    const required = await pool.requiredCollateral(borrower.address, principal);
    expect(required).to.equal(ethers.parseEther("60")); // 60% for prime

    await fxrp.mint(borrower.address, required);
    await fxrp.connect(borrower).approve(await pool.getAddress(), required);
    await pool.connect(borrower).borrow(principal, required);

    const loan = await pool.loans(borrower.address);
    expect(loan.principal).to.equal(principal);
    expect(loan.active).to.equal(true);
  });
});
