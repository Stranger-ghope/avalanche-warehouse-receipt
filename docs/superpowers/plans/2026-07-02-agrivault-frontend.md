# AgriVault Frontend Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js dashboard where Farmers, Warehouse Agents, and MFI Managers connect their wallet and see role-specific views of warehouse receipt data on Avalanche.

**Architecture:** Next.js 14 App Router with wagmi v2 + viem for wallet connection and contract reads. Mock data layer that mirrors the exact WarehouseReceipt and CropRegistry contract interfaces, making the real-contract swap a one-line config change. Tailwind CSS for styling with no component library.

**Tech Stack:** Next.js 14 (App Router), TypeScript, wagmi v2, viem, Tailwind CSS

---

### File Structure

```
frontend/
  src/
    app/
      layout.tsx             # Root layout with WagmiProvider + RainbowKit
      page.tsx               # Dashboard page (role detection + 3 sections)
    config/
      contracts.ts           # Contract addresses + ABI imports
    hooks/
      useWarehouseReceipt.ts # Read receipt data from contract
      useCropRegistry.ts     # Read crop definitions + active crops
      useRole.ts             # Determine if connected user is Farmer/Agent/MFI
    components/
      LoginButton.tsx        # Connect/disconnect wallet button
      ReceiptCard.tsx        # Single receipt display card
      StatusBadge.tsx        # Colored status badge (Issued/Active/Claimed/Defaulted/Expired)
```

---

### Task 1: Scaffold Next.js Project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.js`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/app/globals.css`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/providers.tsx`

- [ ] **Step 1: Create the frontend directory and package.json**

```bash
mkdir -p "D:\ALL WEBSITES\AVALANCHE\frontend\src\app"
mkdir -p "D:\ALL WEBSITES\AVALANCHE\frontend\public"
```

Write `frontend/package.json`:

```json
{
  "name": "agrivault-dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "wagmi": "^2.12.0",
    "viem": "^2.21.0",
    "@tanstack/react-query": "^5.60.0",
    "reown": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/react": "^18.3.0",
    "@types/node": "^20.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

- [ ] **Step 2: Write config files**

Write `frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "es2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Write `frontend/next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
};
module.exports = nextConfig;
```

Write `frontend/tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        farmer: { light: "#dcfce7", DEFAULT: "#16a34a", dark: "#15803d" },
        agent: { light: "#dbeafe", DEFAULT: "#2563eb", dark: "#1d4ed8" },
        mfi: { light: "#fef3c7", DEFAULT: "#d97706", dark: "#b45309" },
      },
    },
  },
  plugins: [],
};
export default config;
```

Write `frontend/postcss.config.js`:
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Write `frontend/src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-50 text-gray-900 antialiased;
}
```

- [ ] **Step 3: Write providers (Wagmi + React Query)**

Write `frontend/src/app/providers.tsx`:
```typescript
"use client";

import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConnector } from "wagmi";
import { injected } from "wagmi/connectors";

const config = createConfig({
  chains: [avalancheFuji],
  connectors: [injected()],
  transports: {
    [avalancheFuji.id]: http("https://api.avax-test.network/ext/bc/C/rpc"),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

- [ ] **Step 4: Write root layout**

Write `frontend/src/app/layout.tsx`:
```typescript
import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgriVault — Digital Warehouse Receipts",
  description: "Tri-party collateral management for smallholder agriculture on Avalanche",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Install dependencies and verify build**

Run:
```bash
cd "D:\ALL WEBSITES\AVALANCHE\frontend"
npm install
npx next build 2>&1 || echo "Build expected to fail until pages are added"
```

Expected: TypeScript errors about missing page.tsx — that's fine. Dependencies installed.

---

### Task 2: Contract Config + ABI

**Files:**
- Create: `frontend/src/config/contracts.ts`

- [ ] **Step 1: Write the contract config file**

`frontend/src/config/contracts.ts` is the single place where contract addresses and ABIs live. When deploying to Fuji, only this file changes.

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/config/contracts.ts
git commit -m "feat(frontend): add contract config with ABIs and types"
```

---

### Task 3: Hooks — useWarehouseReceipt, useCropRegistry, useRole

**Files:**
- Create: `frontend/src/hooks/useWarehouseReceipt.ts`
- Create: `frontend/src/hooks/useCropRegistry.ts`
- Create: `frontend/src/hooks/useRole.ts`

- [ ] **Step 1: Write useWarehouseReceipt hook**

`frontend/src/hooks/useWarehouseReceipt.ts`:
```typescript
import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, WAREHOUSE_RECEIPT_ABI, type ReceiptData } from "@/config/contracts";

/** Fetch a single receipt by token ID */
export function useReceipt(tokenId: number | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.warehouseReceipt,
    abi: WAREHOUSE_RECEIPT_ABI,
    functionName: "getReceipt",
    args: tokenId !== undefined ? [BigInt(tokenId)] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

/** Fetch all token IDs owned by an address */
export function useOwnerTokens(owner: `0x${string}` | undefined) {
  const balance = useReadContract({
    address: CONTRACT_ADDRESSES.warehouseReceipt,
    abi: WAREHOUSE_RECEIPT_ABI,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: { enabled: !!owner },
  });

  const tokenIds: (number | undefined)[] = [];
  const count = Number(balance.data ?? 0);
  for (let i = 0; i < count; i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    tokenIds.push(i); // We'll fetch sequentially; for mock data we use all indices
  }

  return { balance: balance.data, tokenIds, isLoading: balance.isLoading };
}

/** Check if address is a warehouse agent */
export function useIsWarehouseAgent(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.warehouseReceipt,
    abi: WAREHOUSE_RECEIPT_ABI,
    functionName: "warehouseAgents",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

/** Check if address is an approved MFI */
export function useIsApprovedMfi(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.warehouseReceipt,
    abi: WAREHOUSE_RECEIPT_ABI,
    functionName: "approvedMfis",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

/** Get total supply of receipts */
export function useTotalSupply() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.warehouseReceipt,
    abi: WAREHOUSE_RECEIPT_ABI,
    functionName: "totalSupply",
  });
}
```

- [ ] **Step 2: Write useCropRegistry hook**

`frontend/src/hooks/useCropRegistry.ts`:
```typescript
import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, CROP_REGISTRY_ABI } from "@/config/contracts";

/** Fetch crop definition by keccak256 crop type */
export function useCropDefinition(cropType: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.cropRegistry,
    abi: CROP_REGISTRY_ABI,
    functionName: "getCropDefinition",
    args: cropType ? [cropType] : undefined,
    query: { enabled: !!cropType },
  });
}

/** Check if a crop type is active in the registry */
export function useIsCropActive(cropType: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.cropRegistry,
    abi: CROP_REGISTRY_ABI,
    functionName: "isCropActive",
    args: cropType ? [cropType] : undefined,
    query: { enabled: !!cropType },
  });
}
```

- [ ] **Step 3: Write useRole hook**

`frontend/src/hooks/useRole.ts`:
```typescript
"use client";

import { useAccount } from "wagmi";
import { useIsWarehouseAgent, useIsApprovedMfi } from "./useWarehouseReceipt";

export type Role = "farmer" | "agent" | "mfi" | "unverified" | "loading";

/** Determine the role of the connected wallet address.
 *  An address can be a Farmer (holds tokens), Agent (registered), or MFI (approved).
 *  If none match, returns "unverified".
 */
export function useRole(): { role: Role; isLoading: boolean } {
  const { address, isConnected } = useAccount();
  const { data: isAgent, isLoading: agentLoading } = useIsWarehouseAgent(address);
  const { data: isMfi, isLoading: mfiLoading } = useIsApprovedMfi(address);

  if (!isConnected || !address) return { role: "unverified", isLoading: false };
  if (agentLoading || mfiLoading) return { role: "loading", isLoading: true };

  if (isAgent) return { role: "agent", isLoading: false };
  if (isMfi) return { role: "mfi", isLoading: false };
  return { role: "farmer", isLoading: false };
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat(frontend): add contract read hooks and role detection"
```

---

### Task 4: Components — LoginButton, StatusBadge, ReceiptCard

**Files:**
- Create: `frontend/src/components/LoginButton.tsx`
- Create: `frontend/src/components/StatusBadge.tsx`
- Create: `frontend/src/components/ReceiptCard.tsx`

- [ ] **Step 1: Write LoginButton**

`frontend/src/components/LoginButton.tsx`:
```typescript
"use client";

import { useConnect, useAccount, useDisconnect } from "wagmi";

export function LoginButton() {
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAccount();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500 font-mono">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition shadow-sm"
    >
      Connect Wallet
    </button>
  );
}
```

- [ ] **Step 2: Write StatusBadge**

`frontend/src/components/StatusBadge.tsx`:
```typescript
"use client";

import { RECEIPT_STATUS } from "@/config/contracts";

const STATUS_STYLES: Record<number, { label: string; class: string }> = {
  [RECEIPT_STATUS.Issued]: { label: "Issued", class: "bg-blue-100 text-blue-800" },
  [RECEIPT_STATUS.Active]: { label: "Active", class: "bg-green-100 text-green-800" },
  [RECEIPT_STATUS.Claimed]: { label: "Claimed", class: "bg-gray-100 text-gray-600" },
  [RECEIPT_STATUS.Defaulted]: { label: "Defaulted", class: "bg-red-100 text-red-800" },
  [RECEIPT_STATUS.Expired]: { label: "Expired", class: "bg-yellow-100 text-yellow-800" },
};

export function StatusBadge({ status }: { status: number }) {
  const s = STATUS_STYLES[status] ?? { label: "Unknown", class: "bg-gray-100 text-gray-500" };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${s.class}`}>
      {s.label}
    </span>
  );
}
```

- [ ] **Step 3: Write ReceiptCard**

`frontend/src/components/ReceiptCard.tsx`:
```typescript
"use client";

import { type ReceiptData } from "@/config/contracts";
import { useCropDefinition } from "@/hooks/useCropRegistry";
import { StatusBadge } from "./StatusBadge";

function hexToString(hex: `0x${string}`): string {
  try {
    return new TextDecoder().decode(new Uint8Array(hex.slice(2).match(/.{1,2}/g)!.map((b) => parseInt(b, 16))));
  } catch {
    return hex.slice(0, 10);
  }
}

function formatDate(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleDateString();
}

function formatUsd(val: bigint): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(val));
}

export function ReceiptCard({ receipt }: { receipt: ReceiptData }) {
  const { data: cropDef } = useCropDefinition(receipt.cropType);
  const cropName = cropDef ? (cropDef as { name: string }).name : hexToString(receipt.cropType);

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs text-gray-400 font-mono">#{receipt.tokenId}</span>
          <h3 className="text-lg font-semibold text-gray-900">{cropName}</h3>
        </div>
        <StatusBadge status={receipt.status} />
      </div>

      <div className="space-y-1.5 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Quantity</span>
          <span className="font-medium text-gray-900">{receipt.quantityKg.toString()} kg</span>
        </div>
        <div className="flex justify-between">
          <span>Est. Value</span>
          <span className="font-medium text-gray-900">{formatUsd(receipt.estimatedValueUsd)}</span>
        </div>
        <div className="flex justify-between">
          <span>Quality</span>
          <span className="font-medium text-gray-900">{receipt.qualityScore.toString()}/100</span>
        </div>
        <div className="flex justify-between">
          <span>Expires</span>
          <span className="font-medium text-gray-900">{formatDate(receipt.expiryDate)}</span>
        </div>
        <div className="flex justify-between">
          <span>Warehouse</span>
          <span className="font-mono text-xs text-gray-500">{receipt.warehouseId.slice(0, 10)}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 font-mono truncate">
        Farmer: {receipt.farmer.slice(0, 6)}...{receipt.farmer.slice(-4)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/
git commit -m "feat(frontend): add LoginButton, StatusBadge, and ReceiptCard"
```

---

### Task 5: Dashboard Page with Mock Data + Role Sections

**Files:**
- Create: `frontend/src/app/page.tsx`
- Delete `frontend/contracts/` and `frontend/test/` if the scaffold created them.

- [ ] **Step 1: Write the dashboard page**

`frontend/src/app/page.tsx`:
```typescript
"use client";

import { useAccount } from "wagmi";
import { LoginButton } from "@/components/LoginButton";
import { ReceiptCard } from "@/components/ReceiptCard";
import { useRole } from "@/hooks/useRole";
import { RECEIPT_STATUS, type ReceiptData } from "@/config/contracts";
import { useReceipt } from "@/hooks/useWarehouseReceipt";

function Navbar() {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-emerald-700">AgriVault</span>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Avalanche</span>
        </div>
        <LoginButton />
      </div>
    </nav>
  );
}

// ----- MOCK DATA (replace with real contract queries when deployed) -----
const MOCK_RECEIPTS: ReceiptData[] = [
  {
    tokenId: 1,
    farmer: "0x1234567890abcdef1234567890abcdef12345678",
    warehouseAgent: "0x2222222222222222222222222222222222222222",
    mfi: "0x0000000000000000000000000000000000000000",
    quantityKg: 2000n,
    expiryDate: BigInt(Math.floor(Date.now() / 1000) + 86400 * 60),
    warehouseId: "0x57482d3030310000000000000000000000000000000000000000000000000000",
    status: RECEIPT_STATUS.Issued,
    cropType: "0x9a5e3d4c0a7d3f6b8e2c1a9b4d7e3f5c8a2b6d4e1f7a3c9b8e2d5f0a1b3c7d9",
    estimatedValueUsd: 100000n,
    qualityScore: 82n,
    metadataUri: "ipfs://QmTest",
  },
  {
    tokenId: 2,
    farmer: "0x1234567890abcdef1234567890abcdef12345678",
    warehouseAgent: "0x2222222222222222222222222222222222222222",
    mfi: "0x3333333333333333333333333333333333333333",
    quantityKg: 5000n,
    expiryDate: BigInt(Math.floor(Date.now() / 1000) + 86400 * 45),
    warehouseId: "0x57482d3030320000000000000000000000000000000000000000000000000000",
    status: RECEIPT_STATUS.Active,
    cropType: "0x9a5e3d4c0a7d3f6b8e2c1a9b4d7e3f5c8a2b6d4e1f7a3c9b8e2d5f0a1b3c7d9",
    estimatedValueUsd: 250000n,
    qualityScore: 90n,
    metadataUri: "ipfs://QmTest2",
  },
  {
    tokenId: 3,
    farmer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    warehouseAgent: "0x2222222222222222222222222222222222222222",
    mfi: "0x0000000000000000000000000000000000000000",
    quantityKg: 1500n,
    expiryDate: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
    warehouseId: "0x57482d3030330000000000000000000000000000000000000000000000000000",
    status: RECEIPT_STATUS.Issued,
    cropType: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
    estimatedValueUsd: 75000n,
    qualityScore: 70n,
    metadataUri: "ipfs://QmTest3",
  },
];

const MOCK_CROP_NAMES: Record<string, string> = {
  "0x9a5e3d4c0a7d3f6b8e2c1a9b4d7e3f5c8a2b6d4e1f7a3c9b8e2d5f0a1b3c7d9": "Maize",
  "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2": "Rice",
};

function getCropName(cropType: `0x${string}`): string {
  return MOCK_CROP_NAMES[cropType] ?? cropType.slice(0, 10);
}
// ----- END MOCK DATA -----

function RoleBanner({ role }: { role: string }) {
  const banners: Record<string, { emoji: string; title: string; desc: string }> = {
    agent: {
      emoji: "🏛️",
      title: "Warehouse Agent",
      desc: "You are authorized to inspect deposits and issue warehouse receipts.",
    },
    mfi: {
      emoji: "🏦",
      title: "MFI Manager",
      desc: "You can activate, claim, and default receipts for loan management.",
    },
    farmer: {
      emoji: "🌾",
      title: "Farmer",
      desc: "Your wallet holds warehouse receipt tokens. Use them as collateral.",
    },
    unverified: {
      emoji: "👤",
      title: "Unverified",
      desc: "Connect your wallet and register as a participant to get started.",
    },
  };
  const b = banners[role] ?? banners.unverified;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
      <span className="text-3xl">{b.emoji}</span>
      <div>
        <h2 className="font-semibold text-gray-900">{b.title}</h2>
        <p className="text-sm text-gray-500">{b.desc}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="col-span-full text-center py-12 text-gray-400">
      <p className="text-lg">{message}</p>
    </div>
  );
}

function AgentSection({ receipts }: { receipts: ReceiptData[] }) {
  const unverified = receipts.filter((r) => r.status === RECEIPT_STATUS.Issued);
  return (
    <SectionCard title="Unverified Deposits" count={unverified.length}>
      {unverified.length === 0 ? (
        <EmptyState message="No pending deposits to verify." />
      ) : (
        unverified.map((r) => <ReceiptCard key={r.tokenId} receipt={r} />)
      )}
    </SectionCard>
  );
}

function MfiSection({ receipts }: { receipts: ReceiptData[] }) {
  const pending = receipts.filter((r) => r.status === RECEIPT_STATUS.Issued);
  return (
    <SectionCard title="Pending Loan Approvals" count={pending.length}>
      {pending.length === 0 ? (
        <EmptyState message="No pending loan approvals." />
      ) : (
        pending.map((r) => <ReceiptCard key={r.tokenId} receipt={r} />)
      )}
    </SectionCard>
  );
}

function FarmerSection({ receipts }: { receipts: ReceiptData[] }) {
  return (
    <SectionCard title="My Receipts" count={receipts.length}>
      {receipts.length === 0 ? (
        <EmptyState message="No receipts in your wallet." />
      ) : (
        receipts.map((r) => <ReceiptCard key={r.tokenId} receipt={r} />)
      )}
    </SectionCard>
  );
}

export default function Dashboard() {
  const { isConnected } = useAccount();
  const { role, isLoading } = useRole();

  // In mock mode, show all receipts. In live mode, query by owner.
  const allReceipts = MOCK_RECEIPTS;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {!isConnected ? (
          <div className="text-center py-24">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">AgriVault</h1>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Digital warehouse receipts on Avalanche. Connect your wallet to manage collateral, verify deposits, and approve loans.
            </p>
            <LoginButton />
          </div>
        ) : isLoading ? (
          <div className="text-center py-24 text-gray-400">Loading your role...</div>
        ) : (
          <>
            <RoleBanner role={role} />

            {/* Farmer — always sees their receipts */}
            <FarmerSection receipts={allReceipts} />

            {/* Warehouse Agent — sees unverified deposits */}
            {role === "agent" && <AgentSection receipts={allReceipts} />}

            {/* MFI Manager — sees pending loan approvals */}
            {role === "mfi" && <MfiSection receipts={allReceipts} />}
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Run dev server and verify it renders**

Run:
```bash
cd "D:\ALL WEBSITES\AVALANCHE\frontend"
npx next dev
```

Open http://localhost:3000. Expected:
- Landing page with "AgriVault" heading and "Connect Wallet" button
- After connecting via MetaMask/Browser wallet, role banner appears based on connected address
- Receipt cards show with mock data (crop name, quantity, value, status badge)
- Agent/MFI sections render for the correct address types

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(frontend): add dashboard page with role-based sections and mock data"
```

---

## Spec Coverage

| Requirement | Covered In |
|---|---|
| Next.js project with wagmi + viem | Task 1 — providers.tsx with createConfig, avalancheFuji chain |
| /components folder | Task 4 — LoginButton, StatusBadge, ReceiptCard |
| /hooks folder | Task 3 — useWarehouseReceipt, useCropRegistry, useRole |
| ReceiptCard component | Task 4 Step 3 — displays all receipt fields, status badge, crop name |
| LoginButton component | Task 4 Step 1 — connect/disconnect with address display |
| 'My Receipts' (Farmer) | Task 5 — FarmerSection in Dashboard |
| 'Unverified Deposits' (Agent) | Task 5 — AgentSection, filtered by Issued status |
| 'Pending Loan Approvals' (MFI) | Task 5 — MfiSection, filtered by Issued status |
| Modular contract addresses | Task 2 — CONTRACT_ADDRESSES object, single source of truth |
| Avalanche connectivity | Task 1 — avalancheFuji chain, Fuji RPC transport |
| Role detection | Task 3 Step 3 — useRole hook checks on-chain agent/MFI mappings |
