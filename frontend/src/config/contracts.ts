// ============================================================
// AgriVault Contract Configuration
// Swap these addresses when deploying to a new network.
// ============================================================

export const CONTRACT_ADDRESSES = {
  cropRegistry: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  warehouseReceipt: "0x0000000000000000000000000000000000000000" as `0x${string}`,
} as const;

// ----- WarehouseReceipt ABI (read-only functions used by dashboard) -----
export const WAREHOUSE_RECEIPT_ABI = [
  {
    type: "function",
    name: "getReceipt",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct WarehouseReceipt.WarehouseReceiptData",
        components: [
          { name: "farmer", type: "address", internalType: "address" },
          { name: "warehouseAgent", type: "address", internalType: "address" },
          { name: "mfi", type: "address", internalType: "address" },
          { name: "quantityKg", type: "uint256", internalType: "uint256" },
          { name: "expiryDate", type: "uint256", internalType: "uint256" },
          { name: "warehouseId", type: "bytes32", internalType: "bytes32" },
          {
            name: "status",
            type: "uint8",
            internalType: "enum WarehouseReceipt.ReceiptStatus",
          },
          { name: "cropType", type: "bytes32", internalType: "bytes32" },
          { name: "estimatedValueUsd", type: "uint256", internalType: "uint256" },
          { name: "qualityScore", type: "uint256", internalType: "uint256" },
          { name: "metadataUri", type: "string", internalType: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "index", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "warehouseAgents",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approvedMfis",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ----- CropRegistry ABI (read-only functions used by dashboard) -----
export const CROP_REGISTRY_ABI = [
  {
    type: "function",
    name: "isCropActive",
    inputs: [{ name: "cropType", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCropDefinition",
    inputs: [{ name: "cropType", type: "bytes32", internalType: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct CropRegistry.CropDefinition",
        components: [
          { name: "name", type: "string", internalType: "string" },
          { name: "metricKeys", type: "string[]", internalType: "string[]" },
          { name: "minQualityScore", type: "uint256", internalType: "uint256" },
          { name: "active", type: "bool", internalType: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCropCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCropAt",
    inputs: [{ name: "index", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "view",
  },
] as const;

// ----- Status enum mirroring the Solidity contract -----
export const RECEIPT_STATUS = {
  Issued: 0,
  Active: 1,
  Claimed: 2,
  Defaulted: 3,
  Expired: 4,
} as const;

export type ReceiptStatus = (typeof RECEIPT_STATUS)[keyof typeof RECEIPT_STATUS];

// ----- Type for decoded receipt data -----
export interface ReceiptData {
  tokenId: number;
  farmer: `0x${string}`;
  warehouseAgent: `0x${string}`;
  mfi: `0x${string}`;
  quantityKg: bigint;
  expiryDate: bigint;
  warehouseId: `0x${string}`;
  status: number;
  cropType: `0x${string}`;
  estimatedValueUsd: bigint;
  qualityScore: bigint;
  metadataUri: string;
}
