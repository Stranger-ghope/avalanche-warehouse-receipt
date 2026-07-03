<p align="center">
  <h1 align="center">AgriVault</h1>
  <p align="center">Digital Warehouse Receipts on Avalanche</p>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT">
  </a>
  <a href="https://docs.soliditylang.org/">
    <img src="https://img.shields.io/badge/Solidity-^0.8.28-363636?logo=solidity" alt="Solidity">
  </a>
  <a href="https://www.avax.network/">
    <img src="https://img.shields.io/badge/Avalanche-C--Chain-E84142?logo=avalanche" alt="Avalanche">
  </a>
  <a href="https://github.com/Stranger-ghope/avalanche-warehouse-receipt/actions">
    <img src="https://img.shields.io/badge/tests-62%20passing-brightgreen" alt="Tests: 62 passing">
  </a>
  <a href="https://nextjs.org/">
    <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js">
  </a>
</p>

---

Digital collateralization for smallholder cooperatives. **AgriVault** issues digital warehouse receipt tokens on Avalanche C-chain that represent verified harvest deposits, enabling local Microfinance Institutions (MFIs) to assess collateral value on-chain and approve micro-loans in **USDC** — bypassing Malawi's national forex shortage.

## Impact: Closing the Agricultural Collateral Gap in Malawi

In rural Malawi, smallholder farmers grow 80% of the nation's food but are locked out of formal credit. Banks cite one overwhelming reason: **they cannot verify agricultural collateral.** And even when credit is approved, a chronic **national forex shortage** means banks lack the hard currency to disburse loans.

A farmer may have 2,000 kg of stored maize worth $1,000 — but to a lender four hours away, that asset is invisible. Without a trust mechanism to verify and monitor harvest value, and without a channel that bypasses the forex bottleneck, banks default to offering 0% loan approval for unsecured smallholder credit.

**AgriVault bridges both gaps with a tri-party trust model on Avalanche:**

1. A **Warehouse Agent** — a trusted local cooperative officer — physically inspects and signs off on the harvest
2. An **ERC-721 token** is minted on Avalanche C-chain, encoding verified quantity, quality score, and estimated value on-chain
3. An **MFI Manager** reads the token data on-chain and disburses a **USDC micro-loan** via the LoanOrigination contract
4. **Farmers** can deposit idle USDC into the YieldVault to earn yield while they manage their harvest cycle
5. **USDC (a dollar-pegged stablecoin)** holds its value independent of Malawi's foreign reserves, enabling reliable lending without forex exposure

This transforms an invisible asset into a bankable one. The pilot targets maize cooperatives in central Malawi, with planned expansion to rice, coffee, and cocoa across the region.

## Fuji Testnet Deployment

| Contract | Address | Snowtrace (Fuji) |
|---|---|---|
| CropRegistry | `0x1852155e42f6780E89D1e8b991280F54DC7dF0a4` | [View](https://testnet.snowtrace.io/address/0x1852155e42f6780E89D1e8b991280F54DC7dF0a4) |
| WarehouseReceipt | `0xC29E2b635a9721e80280a74D2F4D7CED50C9DA2f` | [View](https://testnet.snowtrace.io/address/0xC29E2b635a9721e80280a74D2F4D7CED50C9DA2f) |
| MockUSDC | `0x197f806214B78B682D73d0d5163d693463DF7601` | [View](https://testnet.snowtrace.io/address/0x197f806214B78B682D73d0d5163d693463DF7601) |
| LoanOrigination | `0xcCF663F53841968C11371fC28619Fff81ad8135d` | [View](https://testnet.snowtrace.io/address/0xcCF663F53841968C11371fC28619Fff81ad8135d) |
| YieldVault | `0x40C8ceD218d89BeBC7DFfD470f82aaaD079d29eB` | [View](https://testnet.snowtrace.io/address/0x40C8ceD218d89BeBC7DFfD470f82aaaD079d29eB) |

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
| **WarehouseReceipt** | ERC-721 token contract. Mints receipts with on-chain collateral data (qualityScore, estimatedValueUsd, quantityKg, expiry). References CropRegistry for crop validation. |

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
- **Testing:** Chai, Hardhat Toolbox (43 passing tests)
- **Frontend:** Next.js 14, wagmi v2, viem, Tailwind CSS
- **Deployment:** Hardhat scripts with env-based configuration

## Getting Started

### Smart Contracts

```bash
npm install
npx hardhat compile
npx hardhat test
```

### Frontend Dashboard

```bash
cd frontend
npm install
npx next dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your wallet (MetaMask on Avalanche Fuji).

### Check a Receipt

```bash
npx hardhat check-receipt --address 0x160f4bEcca5d84a58918342a7AFA6bF65b1E7eb9 --tokenid 0
```

## Project Structure

```
contracts/
  CropRegistry.sol       — Crop type definitions (17 tests)
  WarehouseReceipt.sol   — ERC-721 warehouse receipt token (22 tests)
test/
  Integration.test.ts    — Tri-party flow integration tests (4 tests)
scripts/
  deploy-all.ts          — Full deployment pipeline
frontend/
  src/
    app/                 — Next.js dashboard with role-based views
    config/contracts.ts  — Contract addresses + ABIs (swap for new network)
    hooks/               — useWarehouseReceipt, useCropRegistry, useRole
    components/          — LoginButton, ReceiptCard, StatusBadge
docs/
  2026-07-02-warehouse-receipt-design.md — Design specification
```

## Roadmap

- [x] v1 MVP: CropRegistry + WarehouseReceipt with tri-party roles
- [x] Fuji testnet deployment
- [x] MockUSDC + LoanOrigination + YieldVault contracts
- [x] Frontend dashboard with live contract reads (no mock data)
- [x] USDC loan origination flow (activate, repay, default)
- [x] Yield pool with deposit/withdraw
- [ ] Verify contracts on Snowtrace
- [ ] Avalanche C-chain mainnet deployment
- [ ] Real USDC integration (mainnet swap)
- [ ] On-chain price oracle integration
- [ ] Mobile-friendly farmer dashboard
- [ ] Multi-commodity expansion (rice, coffee, cocoa)

---

*Built for the Avalanche ecosystem. Empowering smallholder farmers through decentralized collateral verification.*
