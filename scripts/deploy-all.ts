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
    MAIZE,
    "Maize",
    ["moisture_content", "grade", "defect_rate"],
    50
  );
  await maizeTx.wait();
  console.log("MAIZE crop registered");

  // 3. Deploy WarehouseReceipt
  const receiptFactory = await hre.ethers.getContractFactory("WarehouseReceipt");
  const receipt = await receiptFactory.deploy(registryAddress);
  await receipt.waitForDeployment();
  const receiptAddress = await receipt.getAddress();
  console.log("WarehouseReceipt deployed to:", receiptAddress);

  // 4. Output summary
  console.log("\n=== Deployment Summary ===");
  console.log("CropRegistry:", registryAddress);
  console.log("WarehouseReceipt:", receiptAddress);
  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
