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
