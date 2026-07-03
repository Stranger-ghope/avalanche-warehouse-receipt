import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // Deploy all contracts
  const cropFactory = await hre.ethers.getContractFactory("CropRegistry");
  const registry = await cropFactory.deploy();
  await registry.waitForDeployment();

  const MAIZE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MAIZE"));
  await registry.registerCrop(MAIZE, "Maize", ["moisture_content", "grade", "defect_rate"], 50);

  const receiptFactory = await hre.ethers.getContractFactory("WarehouseReceipt");
  const receipt = await receiptFactory.deploy(await registry.getAddress());
  await receipt.waitForDeployment();

  const usdcFactory = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await usdcFactory.deploy();
  await usdc.waitForDeployment();

  const loanFactory = await hre.ethers.getContractFactory("LoanOrigination");
  const loan = await loanFactory.deploy(await receipt.getAddress(), await usdc.getAddress());
  await loan.waitForDeployment();

  await receipt.addApprovedMfi(await loan.getAddress());

  const vaultFactory = await hre.ethers.getContractFactory("YieldVault");
  const vault = await vaultFactory.deploy(await usdc.getAddress());
  await vault.waitForDeployment();
  await vault.setApy(820);

  // Write config
  const config = {
    cropRegistry: await registry.getAddress(),
    warehouseReceipt: await receipt.getAddress(),
    mockUSDC: await usdc.getAddress(),
    loanOrigination: await loan.getAddress(),
    yieldVault: await vault.getAddress(),
    deployer: deployer.address,
    network: hre.network.name,
  };

  const outPath = path.join(__dirname, "..", "frontend", "src", "config", "deployed-addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(config, null, 2));
  console.log("Config written to:", outPath);
  console.log(config);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
