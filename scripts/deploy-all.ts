import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1. Deploy CropRegistry
  const cropFactory = await hre.ethers.getContractFactory("CropRegistry");
  const registry = await cropFactory.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("CropRegistry deployed to:", registryAddress);

  // 2. Register MAIZE crop
  const MAIZE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MAIZE"));
  const maizeTx = await registry.registerCrop(
    MAIZE, "Maize", ["moisture_content", "grade", "defect_rate"], 50
  );
  await maizeTx.wait();
  console.log("MAIZE crop registered");

  // 3. Deploy WarehouseReceipt
  const receiptFactory = await hre.ethers.getContractFactory("WarehouseReceipt");
  const receipt = await receiptFactory.deploy(registryAddress);
  await receipt.waitForDeployment();
  const receiptAddress = await receipt.getAddress();
  console.log("WarehouseReceipt deployed to:", receiptAddress);

  // 4. Deploy MockUSDC
  const usdcFactory = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await usdcFactory.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("MockUSDC deployed to:", usdcAddress);

  // 5. Deploy LoanOrigination
  const loanFactory = await hre.ethers.getContractFactory("LoanOrigination");
  const loan = await loanFactory.deploy(receiptAddress, usdcAddress);
  await loan.waitForDeployment();
  const loanAddress = await loan.getAddress();
  console.log("LoanOrigination deployed to:", loanAddress);

  // Wire LoanOrigination as approved MFI in WarehouseReceipt
  const addMfiTx = await receipt.addApprovedMfi(loanAddress);
  await addMfiTx.wait();
  console.log("LoanOrigination added as approved MFI");

  // 6. Deploy YieldVault
  const vaultFactory = await hre.ethers.getContractFactory("YieldVault");
  const vault = await vaultFactory.deploy(usdcAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("YieldVault deployed to:", vaultAddress);

  // Set initial APY (8.2%)
  await vault.setApy(820);
  console.log("YieldVault APY set to 8.2%");

  // 7. Output summary
  console.log("\n=== Deployment Summary ===");
  console.log("CropRegistry:", registryAddress);
  console.log("WarehouseReceipt:", receiptAddress);
  console.log("MockUSDC:", usdcAddress);
  console.log("LoanOrigination:", loanAddress);
  console.log("YieldVault:", vaultAddress);
  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
