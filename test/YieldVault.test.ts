import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("YieldVault", function () {
  async function deployFixture() {
    const [owner, user] = await ethers.getSigners();

    const usdcFactory = await ethers.getContractFactory("MockUSDC");
    const usdc = await usdcFactory.deploy();
    await usdc.faucet(user.address, 10_000n * 10n ** 6n);

    const vaultFactory = await ethers.getContractFactory("YieldVault");
    const vault = await vaultFactory.deploy(await usdc.getAddress());

    return { usdc, vault, owner, user };
  }

  it("should deploy with correct USDC address", async function () {
    const { vault, usdc } = await loadFixture(deployFixture);
    expect(await vault.usdc()).to.equal(await usdc.getAddress());
  });

  it("should deposit and track balance", async function () {
    const { vault, usdc, user } = await loadFixture(deployFixture);
    const amount = 1000n * 10n ** 6n;

    await usdc.connect(user).approve(await vault.getAddress(), amount);
    await expect(vault.connect(user).deposit(amount))
      .to.emit(vault, "Deposited")
      .withArgs(user.address, amount);

    expect(await vault.balances(user.address)).to.equal(amount);
    expect(await vault.totalAssets()).to.equal(amount);
  });

  it("should withdraw", async function () {
    const { vault, usdc, user } = await loadFixture(deployFixture);
    const amount = 1000n * 10n ** 6n;

    await usdc.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(amount);

    await vault.connect(user).withdraw(amount);
    expect(await vault.balances(user.address)).to.equal(0n);
    expect(await vault.totalAssets()).to.equal(0n);
  });

  it("should not withdraw more than balance", async function () {
    const { vault, usdc, user } = await loadFixture(deployFixture);
    const amount = 1000n * 10n ** 6n;

    await usdc.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(amount);

    await expect(
      vault.connect(user).withdraw(amount + 1n)
    ).to.be.revertedWith("YV: insufficient balance");
  });

  it("should set APY (owner only)", async function () {
    const { vault, user } = await loadFixture(deployFixture);

    await vault.setApy(820);
    expect(await vault.apyBps()).to.equal(820);

    await expect(
      vault.connect(user).setApy(500)
    ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
  });
});
