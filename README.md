# Avalanche Warehouse Receipt System

Digital collateralization for smallholder cooperatives. This system issues **digital warehouse receipt tokens** on Avalanche C-chain that represent verified harvest deposits, enabling local Microfinance Institutions (MFIs) to assess collateral value on-chain and approve micro-loans.

## Problem

Banks refuse credit to smallholder farmers because they cannot verify harvest value. A local warehouse agent can physically verify the crop, but there is no digital bridge to make that verification bankable for a lender.

## Solution

A tri-party smart contract system where:

1. **Warehouse Agent** — A trusted third-party verifier physically inspects deposited crops (pilot: maize), signs off on volume and quality, and issues a digital warehouse receipt token.
2. **Farmer (Asset Owner)** — Receives the ERC-721 token representing their stored harvest. The token serves as collateral for a loan.
3. **MFI Manager (Lender)** — Reads receipt data on-chain (quantity, estimated value, quality score, expiry) to assess collateral and approve micro-loans. Can mark loans as claimed or defaulted.

## Tri-Party Model

```
Farmer ──deposits crop──> Warehouse Agent ──issues token──> Farmer holds NFT
                                    │
                                    v
                          MFI reads token on-chain
                          ──────────────────────>
                          Approves micro-loan against collateral
```

### Receipt Lifecycle

```
Issued ──> Active ──> Claimed (repaid)
                ──> Defaulted (seized)
                ──> Expired (timeout)
```

## Architecture

Two-contract design with a registry pattern:

| Contract | Purpose |
|---|---|
| **CropRegistry** | Defines acceptable crop types (maize, rice, etc.) with quality thresholds. Owner-managed. Extensible — add new crops without core changes. |
| **WarehouseReceipt** | ERC-721 token contract. Mints receipts with on-chain collateral data (qualityScore, estimatedValueUsd, quantityKg, expiry). Referenes CropRegistry for crop validation. |

### Data Storage (Hybrid Model)

| Data | Where | Why |
|---|---|---|
| Farmer, Agent, MFI, Quantity, Expiry | On-chain | Core lending assessment |
| EstimatedValueUsd, QualityScore (0–100) | On-chain | Quick MFI risk evaluation |
| Inspection report, photos, moisture content | IPFS (metadataUri) | Full audit trail, fetched on demand |

## Tech Stack

- **Blockchain:** Avalanche C-chain (Fuji testnet → mainnet)
- **Smart Contracts:** Solidity ^0.8.28, OpenZeppelin Contracts 5.x (ERC-721, Ownable)
- **Development:** Hardhat 2.x, TypeScript, Ethers.js v6
- **Testing:** Chai, Hardhat Toolbox, loadFixture pattern
- **Deployment:** Hardhat scripts with env-based configuration

## Getting Started

```bash
npm install
npx hardhat compile
npx hardhat test
```

### Deploy Locally

```bash
npx hardhat run scripts/deploy-all.ts
```

### Deploy to Fuji Testnet

```bash
export FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
export PRIVATE_KEY=your_private_key
npx hardhat run scripts/deploy-all.ts --network fuji
```

### Check a Receipt

```bash
npx hardhat check-receipt --address <contract> --tokenid <id>
```

## Project Structure

```
contracts/
  CropRegistry.sol       — Crop type definitions
  WarehouseReceipt.sol   — ERC-721 warehouse receipt token
test/
  CropRegistry.test.ts   — 17 unit tests
  WarehouseReceipt.test.ts — 22 unit tests
  Integration.test.ts    — 4 integration tests
scripts/
  deploy-all.ts          — Full deployment pipeline
  deploy-crop-registry.ts
  deploy-warehouse-receipt.ts
docs/
  2026-07-02-warehouse-receipt-design.md — Design specification
```

## Roadmap

- [x] v1 MVP: CropRegistry + WarehouseReceipt with tri-party roles
- [ ] Add Avalanche C-chain mainnet deployment config
- [ ] On-chain price oracle integration
- [ ] Lending pool / loan origination contract
- [ ] Mobile-friendly farmer dashboard
- [ ] Multi-commodity expansion (rice, coffee, cocoa)
