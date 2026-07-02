import hre from "hardhat";

async function main() {
  const cropRegistryAddress = process.env.CROP_REGISTRY_ADDRESS || "";
  if (!cropRegistryAddress) {
    throw new Error("CROP_REGISTRY_ADDRESS env var required");
  }

  const factory = await hre.ethers.getContractFactory("WarehouseReceipt");
  const receipt = await factory.deploy(cropRegistryAddress);
  await receipt.waitForDeployment();
  console.log("WarehouseReceipt deployed to:", await receipt.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
