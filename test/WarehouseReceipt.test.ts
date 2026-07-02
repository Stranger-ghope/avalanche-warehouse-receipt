import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";

describe("WarehouseReceipt", function () {
  async function deployFixture() {
    const [owner, agent, mfi, farmer, other] = await ethers.getSigners();

    // Deploy CropRegistry
    const cropFactory = await ethers.getContractFactory("CropRegistry");
    const registry = await cropFactory.deploy();

    // Register MAIZE
    const MAIZE = ethers.keccak256(ethers.toUtf8Bytes("MAIZE"));
    await registry.registerCrop(MAIZE, "Maize", ["moisture_content", "grade"], 50);

    // Deploy WarehouseReceipt
    const receiptFactory = await ethers.getContractFactory("WarehouseReceipt");
    const receipt = await receiptFactory.deploy(await registry.getAddress());

    // Set up roles
    await receipt.addWarehouseAgent(agent.address);
    await receipt.addApprovedMfi(mfi.address);

    return { receipt, registry, owner, agent, mfi, farmer, other, MAIZE };
  }

  it("should deploy with correct registry", async function () {
    const { receipt, registry } = await loadFixture(deployFixture);
    expect(await receipt.cropRegistry()).to.equal(await registry.getAddress());
  });

  it("should allow owner to add warehouse agent", async function () {
    const { receipt, agent, other } = await loadFixture(deployFixture);
    expect(await receipt.warehouseAgents(agent.address)).to.be.true;
    await expect(
      receipt.connect(other).addWarehouseAgent(other.address)
    ).to.be.revertedWithCustomError(receipt, "OwnableUnauthorizedAccount");
  });

  it("should allow owner to add/remove MFI", async function () {
    const { receipt, mfi } = await loadFixture(deployFixture);
    expect(await receipt.approvedMfis(mfi.address)).to.be.true;
    await receipt.removeApprovedMfi(mfi.address);
    expect(await receipt.approvedMfis(mfi.address)).to.be.false;
  });

  it("should issue a receipt", async function () {
    const { receipt, agent, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days

    const tx = await receipt.connect(agent).issueReceipt(
      farmer.address,
      1000, // quantityKg
      expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE,
      50000, // estimatedValueUsd $50
      75, // qualityScore
      "ipfs://QmTest"
    );

    await expect(tx)
      .to.emit(receipt, "ReceiptIssued")
      .withArgs(0, farmer.address, MAIZE, 1000, 50000);

    const tokenId = 0;
    expect(await receipt.ownerOf(tokenId)).to.equal(farmer.address);

    const data = await receipt.getReceipt(tokenId);
    expect(data.farmer).to.equal(farmer.address);
    expect(data.warehouseAgent).to.equal(agent.address);
    expect(data.quantityKg).to.equal(1000n);
    expect(data.qualityScore).to.equal(75n);
    expect(data.status).to.equal(0); // Issued
  });

  it("should not issue receipt for inactive crop", async function () {
    const { receipt, agent, farmer, registry, MAIZE } = await loadFixture(deployFixture);
    await registry.setCropActive(MAIZE, false);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

    await expect(
      receipt.connect(agent).issueReceipt(
        farmer.address, 1000, expiry,
        ethers.encodeBytes32String("WH-001"),
        MAIZE, 50000, 75, "ipfs://QmTest"
      )
    ).to.be.revertedWith("WHR: crop not active");
  });

  it("should not issue with zero quantity", async function () {
    const { receipt, agent, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

    await expect(
      receipt.connect(agent).issueReceipt(
        farmer.address, 0, expiry,
        ethers.encodeBytes32String("WH-001"),
        MAIZE, 50000, 75, "ipfs://QmTest"
      )
    ).to.be.revertedWith("WHR: quantity must be > 0");
  });

  it("should not issue from non-agent", async function () {
    const { receipt, other, farmer, MAIZE } = await loadFixture(deployFixture);

    await expect(
      receipt.connect(other).issueReceipt(
        farmer.address, 1000, 0,
        ethers.encodeBytes32String("WH-001"),
        MAIZE, 50000, 75, "ipfs://QmTest"
      )
    ).to.be.revertedWith("WHR: caller is not a warehouse agent");
  });

  it("should activate a receipt", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );

    const tx = await receipt.connect(mfi).activateReceipt(0, mfi.address);
    await expect(tx).to.emit(receipt, "ReceiptStatusUpdated").withArgs(0, 1); // Active

    const data = await receipt.getReceipt(0);
    expect(data.status).to.equal(1); // Active
    expect(data.mfi).to.equal(mfi.address);
  });

  it("should mark receipt claimed", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );
    await receipt.connect(mfi).activateReceipt(0, mfi.address);

    const tx = await receipt.connect(mfi).markClaimed(0);
    await expect(tx).to.emit(receipt, "ReceiptStatusUpdated").withArgs(0, 2); // Claimed
  });

  it("should mark receipt defaulted", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );
    await receipt.connect(mfi).activateReceipt(0, mfi.address);

    const tx = await receipt.connect(mfi).markDefaulted(0);
    await expect(tx).to.emit(receipt, "ReceiptStatusUpdated").withArgs(0, 3); // Defaulted
  });

  it("should not transition from Issued to Claimed directly", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );

    await expect(
      receipt.connect(mfi).markClaimed(0)
    ).to.be.revertedWith("WHR: receipt not Active");
  });

  it("should expire an active receipt after expiry date", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(deployFixture);

    // Use a timestamp-based expiry to ensure it's strictly in the future
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const expiry = block.timestamp + 10; // 10 seconds from now
    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );

    // Advance time past expiry
    await ethers.provider.send("evm_increaseTime", [15]);
    await ethers.provider.send("evm_mine", []);

    await receipt.expireReceipt(0);
    const data = await receipt.getReceipt(0);
    expect(data.status).to.equal(4); // Expired
  });
});
