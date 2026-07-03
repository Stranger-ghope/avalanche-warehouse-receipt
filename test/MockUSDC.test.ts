import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("MockUSDC", function () {
  async function deployFixture() {
    const [deployer, user] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("MockUSDC");
    const usdc = await factory.deploy();
    return { usdc, deployer, user };
  }

  it("should have correct name, symbol, decimals", async function () {
    const { usdc } = await loadFixture(deployFixture);
    expect(await usdc.name()).to.equal("Mock USDC");
    expect(await usdc.symbol()).to.equal("USDC");
    expect(await usdc.decimals()).to.equal(6);
  });

  it("should mint initial supply to deployer", async function () {
    const { usdc, deployer } = await loadFixture(deployFixture);
    const balance = await usdc.balanceOf(deployer.address);
    expect(balance).to.equal(1_000_000_000n * 10n ** 6n);
  });

  it("should allow faucet to mint to anyone", async function () {
    const { usdc, user } = await loadFixture(deployFixture);
    await usdc.faucet(user.address, 1000n * 10n ** 6n);
    expect(await usdc.balanceOf(user.address)).to.equal(1000n * 10n ** 6n);
  });
});
