// ============================================================
// AgriVault Contract Configuration
// Swap these addresses when deploying to a new network.
// ============================================================

export const CONTRACT_ADDRESSES = {
  cropRegistry: "0x8BAd899c4C70CA7245AB34f437EB69ca80ff9eBe" as `0x${string}`,
  warehouseReceipt: "0x160f4bEcca5d84a58918342a7AFA6bF65b1E7eb9" as `0x${string}`,
  // New contracts (update after Fuji deployment):
  mockUSDC: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  loanOrigination: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  yieldVault: "0x0000000000000000000000000000000000000000" as `0x${string}`,
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

// ============================================================
// MockUSDC ABI (functions used by dashboard)
// ============================================================
export const MOCK_USDC_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "from", type: "address", internalType: "address" },
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "faucet",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
  },
] as const;

// ============================================================
// LoanOrigination ABI
// ============================================================
export const LOAN_ORIGINATION_ABI = [
  {
    type: "function",
    name: "activateLoan",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "repayLoan",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "defaultLoan",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "authorizedMfis",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "loans",
    inputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "farmer", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "mfi", type: "address", internalType: "address" },
      { name: "active", type: "bool", internalType: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "activeLoanCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "poolBalance",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ============================================================
// YieldVault ABI
// ============================================================
export const YIELD_VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balances",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalAssets",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "apyBps",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ----- Write-function ABIs for WarehouseReceipt (used by Agent/MFI flows) -----
export const WAREHOUSE_RECEIPT_WRITE_ABI = [
  {
    type: "function",
    name: "issueReceipt",
    inputs: [
      { name: "farmer", type: "address", internalType: "address" },
      { name: "quantityKg", type: "uint256", internalType: "uint256" },
      { name: "expiryDate", type: "uint256", internalType: "uint256" },
      { name: "warehouseId", type: "bytes32", internalType: "bytes32" },
      { name: "cropType", type: "bytes32", internalType: "bytes32" },
      { name: "estimatedValueUsd", type: "uint256", internalType: "uint256" },
      { name: "qualityScore", type: "uint256", internalType: "uint256" },
      { name: "metadataUri", type: "string", internalType: "string" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "activateReceipt",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
