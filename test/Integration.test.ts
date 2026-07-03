import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";

describe("Integration: Full Tri-Party Flow", function () {
  async function fullDeployFixture() {
    const [owner, agent, mfi, farmer] = await ethers.getSigners();

    // Deploy registry
    const cropFactory = await ethers.getContractFactory("CropRegistry");
    const registry = await cropFactory.deploy();

    // Register crops
    const MAIZE = ethers.keccak256(ethers.toUtf8Bytes("MAIZE"));
    const RICE = ethers.keccak256(ethers.toUtf8Bytes("RICE"));
    await registry.registerCrop(MAIZE, "Maize", ["moisture_content", "grade", "defect_rate"], 50);
    await registry.registerCrop(RICE, "Rice", ["moisture_content", "purity"], 40);

    // Deploy WarehouseReceipt
    const receiptFactory = await ethers.getContractFactory("WarehouseReceipt");
    const receipt = await receiptFactory.deploy(await registry.getAddress());

    // Configure roles
    await receipt.addWarehouseAgent(agent.address);
    await receipt.addApprovedMfi(mfi.address);

    return { receipt, registry, owner, agent, mfi, farmer, MAIZE, RICE };
  }

  it("should complete the full happy path: Issue → Activate → Claim", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(fullDeployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

    // 1. Agent issues receipt for farmer
    const issueTx = await receipt.connect(agent).issueReceipt(
      farmer.address,
      2000, // 2000kg maize
      expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE,
      100000, // $100k estimated value
      82,    // quality score
      "ipfs://QmInspectionReport123"
    );
    await expect(issueTx).to.emit(receipt, "ReceiptIssued");
    expect(await receipt.ownerOf(0)).to.equal(farmer.address);

    // A non-MFI cannot activate
    await expect(
      receipt.connect(agent).activateReceipt(0)
    ).to.be.revertedWith("WHR: caller is not an approved MFI");

    // 2. MFI activates the receipt — commits to lending
    const activateTx = await receipt.connect(mfi).activateReceipt(0);
    await expect(activateTx).to.emit(receipt, "ReceiptStatusUpdated").withArgs(0, 1);

    const activeReceipt = await receipt.getReceipt(0);
    expect(activeReceipt.status).to.equal(1); // Active
    expect(activeReceipt.mfi).to.equal(mfi.address);

    // 3. MFI marks as claimed (farmer repaid)
    const claimTx = await receipt.connect(mfi).markClaimed(0);
    await expect(claimTx).to.emit(receipt, "ReceiptStatusUpdated").withArgs(0, 2);

    const claimedReceipt = await receipt.getReceipt(0);
    expect(claimedReceipt.status).to.equal(2); // Claimed

    // Verify token data is still accessible
    expect(claimedReceipt.farmer).to.equal(farmer.address);
    expect(claimedReceipt.quantityKg).to.equal(2000n);
    expect(claimedReceipt.cropType).to.equal(MAIZE);
  });

  it("should complete Issue → Activate → Default path", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(fullDeployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

    await receipt.connect(agent).issueReceipt(
      farmer.address, 1500, expiry,
      ethers.encodeBytes32String("WH-002"),
      MAIZE, 75000, 70, "ipfs://QmInspection456"
    );
    await receipt.connect(mfi).activateReceipt(0);
    await receipt.connect(mfi).markDefaulted(0);

    const data = await receipt.getReceipt(0);
    expect(data.status).to.equal(3); // Defaulted
  });

  it("should work with multiple crop types", async function () {
    const { receipt, agent, mfi, farmer, MAIZE, RICE } = await loadFixture(fullDeployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

    // Issue maize receipt
    await receipt.connect(agent).issueReceipt(
      farmer.address, 2000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 100000, 82, "ipfs://QmMaize"
    );

    // Issue rice receipt
    await receipt.connect(agent).issueReceipt(
      farmer.address, 5000, expiry,
      ethers.encodeBytes32String("WH-002"),
      RICE, 250000, 90, "ipfs://QmRice"
    );

    // Verify both
    const maizeReceipt = await receipt.getReceipt(0);
    expect(maizeReceipt.cropType).to.equal(MAIZE);
    expect(maizeReceipt.quantityKg).to.equal(2000n);

    const riceReceipt = await receipt.getReceipt(1);
    expect(riceReceipt.cropType).to.equal(RICE);
    expect(riceReceipt.quantityKg).to.equal(5000n);

    // Both tokens owned by farmer
    expect(await receipt.ownerOf(0)).to.equal(farmer.address);
    expect(await receipt.ownerOf(1)).to.equal(farmer.address);
  });

  it("should prevent expired receipts from being activated", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(fullDeployFixture);

    // Use block timestamp to determine expiry (like existing tests do)
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const expiry = block.timestamp + 10; // 10 seconds from now

    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );

    // Advance past expiry
    await ethers.provider.send("evm_increaseTime", [15]);
    await ethers.provider.send("evm_mine", []);

    await expect(
      receipt.connect(mfi).activateReceipt(0)
    ).to.be.revertedWith("WHR: receipt expired");
  });
});

describe("Integration: Full Loan Flow (USDC + LoanOrigination)", function () {
  async function fullLoanFixture() {
    const [owner, agent, mfi, farmer] = await ethers.getSigners();

    // Deploy MockUSDC
    const usdcFactory = await ethers.getContractFactory("MockUSDC");
    const usdc = await usdcFactory.deploy();

    // Deploy CropRegistry
    const cropFactory = await ethers.getContractFactory("CropRegistry");
    const registry = await cropFactory.deploy();
    const MAIZE = ethers.keccak256(ethers.toUtf8Bytes("MAIZE"));
    await registry.registerCrop(MAIZE, "Maize", ["moisture_content", "grade"], 50);

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

    // Wire LoanOrigination as approved MFI
    await receipt.addApprovedMfi(await loan.getAddress());
    await loan.setMfiAuthorization(mfi.address, true);

    // Fund MFI with USDC and deposit into loan pool
    await usdc.faucet(mfi.address, 1_000_000n * 10n ** 6n);
    await usdc.connect(mfi).transfer(await loan.getAddress(), 500_000n * 10n ** 6n);

    // Deploy YieldVault
    const vaultFactory = await ethers.getContractFactory("YieldVault");
    const vault = await vaultFactory.deploy(await usdc.getAddress());
    await vault.setApy(820); // 8.2%

    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

    return { usdc, receipt, loan, vault, owner, agent, mfi, farmer, MAIZE, expiry };
  }

  it("should complete full flow: Issue → ActivateLoan → Repay", async function () {
    const { usdc, receipt, loan, agent, mfi, farmer, MAIZE, expiry } =
      await loadFixture(fullLoanFixture);

    // 1. Agent issues receipt
    await receipt.connect(agent).issueReceipt(
      farmer.address, 2000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 100_000, 82, "ipfs://QmTest"
    );

    // 2. MFI activates loan — USDC disbursed to farmer
    const farmerBalBefore = await usdc.balanceOf(farmer.address);
    expect(farmerBalBefore).to.equal(0n);

    await expect(loan.connect(mfi).activateLoan(0))
      .to.emit(loan, "LoanActivated")
      .withArgs(0, farmer.address, 100_000n);

    expect(await usdc.balanceOf(farmer.address)).to.equal(100_000n);
    expect(await loan.activeLoanCount()).to.equal(1n);

    // Verify receipt is Active
    const receiptData = await receipt.getReceipt(0);
    expect(receiptData.status).to.equal(1); // Active
    expect(receiptData.mfi).to.equal(await loan.getAddress());

    // 3. Farmer repays
    await usdc.connect(farmer).approve(await loan.getAddress(), 100_000n);
    await expect(loan.connect(farmer).repayLoan(0))
      .to.emit(loan, "LoanRepaid")
      .withArgs(0, farmer.address, 100_000n);

    expect(await loan.activeLoanCount()).to.equal(0n);

    // Verify receipt is Claimed
    const claimedData = await receipt.getReceipt(0);
    expect(claimedData.status).to.equal(2); // Claimed
  });

  it("should complete flow: Issue → ActivateLoan → Default", async function () {
    const { receipt, loan, agent, mfi, farmer, MAIZE, expiry } =
      await loadFixture(fullLoanFixture);

    await receipt.connect(agent).issueReceipt(
      farmer.address, 1500, expiry,
      ethers.encodeBytes32String("WH-002"),
      MAIZE, 75_000, 70, "ipfs://QmTest2"
    );

    await loan.connect(mfi).activateLoan(0);
    await loan.connect(mfi).defaultLoan(0);

    const data = await receipt.getReceipt(0);
    expect(data.status).to.equal(3); // Defaulted
  });

  it("should allow farmer to deposit USDC into YieldVault", async function () {
    const { usdc, receipt, loan, vault, agent, mfi, farmer, MAIZE, expiry } =
      await loadFixture(fullLoanFixture);

    // Issue + activate to give farmer USDC
    await receipt.connect(agent).issueReceipt(
      farmer.address, 2000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 100_000, 82, "ipfs://QmTest"
    );
    await loan.connect(mfi).activateLoan(0);

    // Farmer deposits half into yield vault
    const depositAmount = 50_000n;
    await usdc.connect(farmer).approve(await vault.getAddress(), depositAmount);
    await vault.connect(farmer).deposit(depositAmount);

    expect(await vault.balances(farmer.address)).to.equal(depositAmount);
    expect(await vault.totalAssets()).to.equal(depositAmount);
    expect(await vault.apyBps()).to.equal(820);
  });
});
