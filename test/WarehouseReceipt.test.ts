import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";

describe("WarehouseReceipt", function () {
  // ReceiptStatus enum values matching the Solidity contract
  const Status = { Issued: 0, Active: 1, Claimed: 2, Defaulted: 3, Expired: 4 };

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
    expect(data.status).to.equal(Status.Issued);
    expect(await receipt.tokenURI(0)).to.equal("ipfs://QmTest");
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

    const tx = await receipt.connect(mfi).activateReceipt(0);
    await expect(tx).to.emit(receipt, "ReceiptStatusUpdated").withArgs(0, Status.Active);

    const data = await receipt.getReceipt(0);
    expect(data.status).to.equal(Status.Active);
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
    await receipt.connect(mfi).activateReceipt(0);

    const tx = await receipt.connect(mfi).markClaimed(0);
    await expect(tx).to.emit(receipt, "ReceiptStatusUpdated").withArgs(0, Status.Claimed);
  });

  it("should mark receipt defaulted", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );
    await receipt.connect(mfi).activateReceipt(0);

    const tx = await receipt.connect(mfi).markDefaulted(0);
    await expect(tx).to.emit(receipt, "ReceiptStatusUpdated").withArgs(0, Status.Defaulted);
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
    expect(data.status).to.equal(Status.Expired);
  });

  it("should expire a receipt from Issued status", async function () {
    const { receipt, agent, farmer, MAIZE } = await loadFixture(deployFixture);
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const expiry = block.timestamp + 10;
    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );

    await ethers.provider.send("evm_increaseTime", [15]);
    await ethers.provider.send("evm_mine", []);

    await receipt.expireReceipt(0);
    const data = await receipt.getReceipt(0);
    expect(data.status).to.equal(Status.Expired);
  });

  it("should not activate receipt from non-MFI caller", async function () {
    const { receipt, agent, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );
    await expect(
      receipt.connect(agent).activateReceipt(0)
    ).to.be.revertedWith("WHR: caller is not an approved MFI");
  });

  it("should not issue receipt with past expiry", async function () {
    const { receipt, agent, farmer, MAIZE } = await loadFixture(deployFixture);
    const past = Math.floor(Date.now() / 1000) - 86400;
    await expect(
      receipt.connect(agent).issueReceipt(
        farmer.address, 1000, past,
        ethers.encodeBytes32String("WH-001"),
        MAIZE, 50000, 75, "ipfs://QmTest"
      )
    ).to.be.revertedWith("WHR: expiry must be in the future");
  });

  it("should revert getReceipt for non-existent token", async function () {
    const { receipt } = await loadFixture(deployFixture);
    await expect(
      receipt.getReceipt(999)
    ).to.be.revertedWith("WHR: token does not exist");
  });

  it("should revert tokenURI for non-existent token", async function () {
    const { receipt } = await loadFixture(deployFixture);
    await expect(
      receipt.tokenURI(999)
    ).to.be.revertedWith("WHR: token does not exist");
  });

  it("should not allow non-owner to add MFI", async function () {
    const { receipt, other, mfi } = await loadFixture(deployFixture);
    await expect(
      receipt.connect(other).addApprovedMfi(mfi.address)
    ).to.be.revertedWithCustomError(receipt, "OwnableUnauthorizedAccount");
  });

  it("should not allow non-owner to remove warehouse agent", async function () {
    const { receipt, other, agent } = await loadFixture(deployFixture);
    await expect(
      receipt.connect(other).removeWarehouseAgent(agent.address)
    ).to.be.revertedWithCustomError(receipt, "OwnableUnauthorizedAccount");
  });

  it("should not issue receipt with quality score over 100", async function () {
    const { receipt, agent, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await expect(
      receipt.connect(agent).issueReceipt(
        farmer.address, 1000, expiry,
        ethers.encodeBytes32String("WH-001"),
        MAIZE, 50000, 101, "ipfs://QmTest"
      )
    ).to.be.revertedWith("WHR: quality score out of range");
  });

  it("should not transfer an active receipt", async function () {
    const { receipt, agent, mfi, farmer, other, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );
    await receipt.connect(mfi).activateReceipt(0);

    // Farmer should not be able to transfer while Active
    await expect(
      receipt.connect(farmer).transferFrom(farmer.address, other.address, 0)
    ).to.be.revertedWith("WHR: cannot transfer active receipt");
  });

  it("should allow transfer of a non-active receipt", async function () {
    const { receipt, agent, mfi, farmer, other, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );
    await receipt.connect(mfi).activateReceipt(0);
    await receipt.connect(mfi).markClaimed(0);

    // Should allow transfer after claimed
    await expect(
      receipt.connect(farmer).transferFrom(farmer.address, other.address, 0)
    ).to.not.be.reverted;
    expect(await receipt.ownerOf(0)).to.equal(other.address);
  });
});
