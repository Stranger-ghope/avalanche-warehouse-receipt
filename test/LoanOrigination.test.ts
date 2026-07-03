import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("LoanOrigination", function () {
  async function deployFixture() {
    const [owner, agent, mfi, farmer, other] = await ethers.getSigners();

    // Deploy MockUSDC
    const usdcFactory = await ethers.getContractFactory("MockUSDC");
    const usdc = await usdcFactory.deploy();

    // Deploy CropRegistry
    const cropFactory = await ethers.getContractFactory("CropRegistry");
    const registry = await cropFactory.deploy();
    const MAIZE = ethers.keccak256(ethers.toUtf8Bytes("MAIZE"));
    await registry.registerCrop(MAIZE, "Maize", ["moisture_content"], 50);

    // Deploy WarehouseReceipt
    const receiptFactory = await ethers.getContractFactory("WarehouseReceipt");
    const receipt = await receiptFactory.deploy(await registry.getAddress());
    await receipt.addWarehouseAgent(agent.address);

    // Deploy LoanOrigination
    const loanFactory = await ethers.getContractFactory("LoanOrigination");
    const loan = await loanFactory.deploy(
      await receipt.getAddress(),
      await usdc.getAddress()
    );

    // Add LoanOrigination as approved MFI in WarehouseReceipt
    await receipt.addApprovedMfi(await loan.getAddress());

    // Add MFI as authorized in LoanOrigination
    await loan.setMfiAuthorization(mfi.address, true);

    // Fund MFI with USDC and have them deposit into LoanOrigination pool
    await usdc.faucet(mfi.address, 1_000_000n * 10n ** 6n);
    await usdc.connect(mfi).transfer(await loan.getAddress(), 500_000n * 10n ** 6n);

    // Issue a receipt
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt.connect(agent).issueReceipt(
      farmer.address,
      2000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 100_000, 82, "ipfs://QmTest"
    );

    return { usdc, receipt, loan, owner, agent, mfi, farmer, other, MAIZE };
  }

  it("should deploy with correct addresses", async function () {
    const { loan, receipt, usdc } = await loadFixture(deployFixture);
    expect(await loan.warehouseReceipt()).to.equal(await receipt.getAddress());
    expect(await loan.usdc()).to.equal(await usdc.getAddress());
  });

  it("should allow owner to authorize MFIs", async function () {
    const { loan, mfi, other } = await loadFixture(deployFixture);
    expect(await loan.authorizedMfis(mfi.address)).to.be.true;
    await loan.setMfiAuthorization(mfi.address, false);
    expect(await loan.authorizedMfis(mfi.address)).to.be.false;
    await expect(
      loan.connect(other).setMfiAuthorization(other.address, true)
    ).to.be.revertedWithCustomError(loan, "OwnableUnauthorizedAccount");
  });

  it("should activate loan and disburse USDC to farmer", async function () {
    const { loan, usdc, mfi, farmer } = await loadFixture(deployFixture);

    const farmerBalanceBefore = await usdc.balanceOf(farmer.address);
    expect(farmerBalanceBefore).to.equal(0n);

    await expect(loan.connect(mfi).activateLoan(0))
      .to.emit(loan, "LoanActivated")
      .withArgs(0, farmer.address, 100_000n);

    const farmerBalance = await usdc.balanceOf(farmer.address);
    expect(farmerBalance).to.equal(100_000n);

    expect(await loan.activeLoanCount()).to.equal(1n);

    const loanData = await loan.loans(0);
    expect(loanData.active).to.be.true;
    expect(loanData.farmer).to.equal(farmer.address);
  });

  it("should not activate if caller is not authorized MFI", async function () {
    const { loan, agent } = await loadFixture(deployFixture);
    await expect(
      loan.connect(agent).activateLoan(0)
    ).to.be.revertedWith("LO: not authorized");
  });

  it("should not activate if pool has insufficient USDC", async function () {
    const { usdc, mfi, farmer, agent, MAIZE } = await loadFixture(deployFixture);
    // Deploy a fresh minimal setup with empty pool
    const cropFactory = await ethers.getContractFactory("CropRegistry");
    const registry = await cropFactory.deploy();
    const MAIZE2 = ethers.keccak256(ethers.toUtf8Bytes("MAIZE"));
    await registry.registerCrop(MAIZE2, "Maize", ["moisture_content"], 50);

    const receiptFactory = await ethers.getContractFactory("WarehouseReceipt");
    const receipt2 = await receiptFactory.deploy(await registry.getAddress());
    await receipt2.addWarehouseAgent(agent.address);

    const usdcFactory = await ethers.getContractFactory("MockUSDC");
    const usdc2 = await usdcFactory.deploy();

    const loanFactory = await ethers.getContractFactory("LoanOrigination");
    const loan2 = await loanFactory.deploy(await receipt2.getAddress(), await usdc2.getAddress());
    await receipt2.addApprovedMfi(await loan2.getAddress());
    await loan2.setMfiAuthorization(mfi.address, true);

    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt2.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE2, 50000, 75, "ipfs://QmTest"
    );

    // Pool has 0 USDC, activate should fail
    await expect(
      loan2.connect(mfi).activateLoan(0)
    ).to.be.revertedWith("LO: insufficient pool");
  });

  it("should repay loan", async function () {
    const { loan, usdc, mfi, farmer } = await loadFixture(deployFixture);

    await loan.connect(mfi).activateLoan(0);

    const loanAmount = 100_000n;
    await usdc.connect(farmer).approve(await loan.getAddress(), loanAmount);

    await expect(loan.connect(farmer).repayLoan(0))
      .to.emit(loan, "LoanRepaid")
      .withArgs(0, farmer.address, loanAmount);

    expect(await loan.activeLoanCount()).to.equal(0n);

    const loanData = await loan.loans(0);
    expect(loanData.active).to.be.false;
  });

  it("should not allow non-farmer to repay", async function () {
    const { loan, mfi, other } = await loadFixture(deployFixture);

    await loan.connect(mfi).activateLoan(0);

    await expect(
      loan.connect(other).repayLoan(0)
    ).to.be.revertedWith("LO: not farmer");
  });

  it("should default loan", async function () {
    const { loan, mfi } = await loadFixture(deployFixture);

    await loan.connect(mfi).activateLoan(0);

    await expect(loan.connect(mfi).defaultLoan(0))
      .to.emit(loan, "LoanDefaulted")
      .withArgs(0);

    expect(await loan.activeLoanCount()).to.equal(0n);
  });
});
