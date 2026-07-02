import hre from "hardhat";

async function main() {
  const factory = await hre.ethers.getContractFactory("CropRegistry");
  const registry = await factory.deploy();
  await registry.waitForDeployment();
  console.log("CropRegistry deployed to:", await registry.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
