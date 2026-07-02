import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    fuji: {
      url: process.env.FUJI_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

task("check-receipt", "Check receipt details")
  .addParam("address", "WarehouseReceipt contract address")
  .addParam("tokenid", "Token ID to check")
  .setAction(async (args, hre) => {
    const receipt = await hre.ethers.getContractAt("WarehouseReceipt", args.address);
    const data = await receipt.getReceipt(args.tokenid);
    console.log("Receipt:", {
      farmer: data.farmer,
      warehouseAgent: data.warehouseAgent,
      mfi: data.mfi,
      quantityKg: data.quantityKg.toString(),
      expiryDate: new Date(Number(data.expiryDate) * 1000).toISOString(),
      status: ["Issued", "Active", "Claimed", "Defaulted", "Expired"][Number(data.status)],
      estimatedValueUsd: data.estimatedValueUsd.toString(),
      qualityScore: data.qualityScore.toString(),
    });
  });

export default config;
