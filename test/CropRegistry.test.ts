import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";

describe("CropRegistry", function () {
  async function deployFixture() {
    const [owner, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("CropRegistry");
    const registry = await factory.deploy();
    return { registry, owner, other };
  }

  const MAIZE = ethers.keccak256(ethers.toUtf8Bytes("MAIZE"));
  const RICE = ethers.keccak256(ethers.toUtf8Bytes("RICE"));

  it("should deploy with correct owner", async function () {
    const { registry, owner } = await loadFixture(deployFixture);
    expect(await registry.owner()).to.equal(owner.address);
  });

  it("should register a new crop", async function () {
    const { registry } = await loadFixture(deployFixture);
    const tx = await registry.registerCrop(
      MAIZE, "Maize", ["moisture_content", "grade", "defect_rate"], 50
    );
    await expect(tx).to.emit(registry, "CropRegistered").withArgs(MAIZE, "Maize");

    expect(await registry.isCropActive(MAIZE)).to.be.true;
    expect(await registry.getCropCount()).to.equal(1n);
    expect(await registry.getCropAt(0)).to.equal(MAIZE);
  });

  it("should not allow non-owner to register", async function () {
    const { registry, other } = await loadFixture(deployFixture);
    await expect(
      registry.connect(other).registerCrop(MAIZE, "Maize", [], 50)
    ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
  });

  it("should not allow duplicate registration", async function () {
    const { registry } = await loadFixture(deployFixture);
    await registry.registerCrop(MAIZE, "Maize", [], 50);
    await expect(
      registry.registerCrop(MAIZE, "Maize", [], 50)
    ).to.be.revertedWith("Crop already registered");
  });

  it("should toggle crop active status", async function () {
    const { registry } = await loadFixture(deployFixture);
    await registry.registerCrop(MAIZE, "Maize", [], 50);
    await registry.setCropActive(MAIZE, false);
    expect(await registry.isCropActive(MAIZE)).to.be.false;
  });

  it("should return crop definition", async function () {
    const { registry } = await loadFixture(deployFixture);
    await registry.registerCrop(
      MAIZE, "Maize", ["moisture_content", "grade"], 50
    );
    const def = await registry.getCropDefinition(MAIZE);
    expect(def.name).to.equal("Maize");
    expect(def.minQualityScore).to.equal(50n);
    expect(def.active).to.be.true;
    expect(def.metricKeys).to.deep.equal(["moisture_content", "grade"]);
  });

  it("should revert for unregistered crop", async function () {
    const { registry } = await loadFixture(deployFixture);
    await expect(
      registry.getCropDefinition(ethers.keccak256(ethers.toUtf8Bytes("UNKNOWN")))
    ).to.be.revertedWith("Crop not found");
  });

  it("should update an existing crop", async function () {
    const { registry } = await loadFixture(deployFixture);
    await registry.registerCrop(MAIZE, "Maize", ["moisture_content"], 50);
    await registry.updateCrop(
      MAIZE, "Maize Premium", ["moisture_content", "grade", "defect_rate"], 70, true
    );
    const def = await registry.getCropDefinition(MAIZE);
    expect(def.name).to.equal("Maize Premium");
    expect(def.minQualityScore).to.equal(70n);
    expect(def.metricKeys).to.have.lengthOf(3);
  });

  it("should list multiple crops", async function () {
    const { registry } = await loadFixture(deployFixture);
    await registry.registerCrop(MAIZE, "Maize", [], 50);
    await registry.registerCrop(RICE, "Rice", [], 40);
    expect(await registry.getCropCount()).to.equal(2n);
    expect(await registry.getCropAt(0)).to.equal(MAIZE);
    expect(await registry.getCropAt(1)).to.equal(RICE);
  });
});
