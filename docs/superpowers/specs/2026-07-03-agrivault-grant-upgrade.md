# AgriVault Grant Upgrade — Design Spec

**Date:** 2026-07-03
**Status:** Draft

---

## 1. Grant Narrative (Forex-Resilient Stablecoin Lending)

Malawi's smallholder farmers face a double exclusion: they are **credit-invisible** (banks cannot verify agricultural collateral) and trapped by a **national forex shortage** that stalls hard-currency lending even when credit is approved. AgriVault solves both simultaneously.

**Thesis:** By issuing digital warehouse receipts on Avalanche C-chain and disbursing micro-loans in USDC (a dollar-pegged stablecoin), AgriVault bypasses Malawi's banking-system forex bottleneck entirely. A farmer's harvest becomes globally-visible collateral; a loan disbursed in USDC holds its value independent of local currency reserves.

**Pilot region:** Central Malawi (maize cooperatives), expanding to rice, coffee, cocoa.

**Key grant messaging:**
- *Stablecoin lending on Avalanche* — sub-second finality + near-zero fees make micro-loans viable
- *Forex-resilient* — USDC bypasses Malawi's foreign-reserve constraints
- *Tri-party trust on-chain* — Agent verifies → Farmer holds NFT → MFI lends USDC
- *On-chain yield* — idle stablecoins earn yield in a simple vault, building a capital-market layer for smallholder agriculture

---

## 2. Smart Contract Architecture

### Existing Contracts (unchanged)

| Contract | Location | Status |
|---|---|---|
| CropRegistry | `contracts/CropRegistry.sol` | Deployed on Fuji |
| WarehouseReceipt | `contracts/WarehouseReceipt.sol` | Deployed on Fuji |

### New Contracts

#### MockUSDC

- Standard ERC-20, 6 decimals (matches mainnet USDC interface)
- Constructor mints initial supply to deployer for test distribution
- Swap address for real USDC on mainnet deploy

#### LoanOrigination

Connects WarehouseReceipt + USDC. Enables the tri-party lending flow.

```
Roles:
  - Owner: can withdraw stuck funds, pause
  - MFIs: can activate loans, mark claimed/defaulted
  
Flow:
  1. MFI deposits USDC -> LoanOrigination          (pre-funds pool)
  2. Receipt issued (on WarehouseReceipt)          (Agent mints NFT)
  3. MFI calls activateReceipt(tokenId) ->          (checks receipt is Issued)
     LoanOrigination transfers USDC to farmer       (loan disbursed)
  4. Farmer repays -> sends USDC back to LoanOrigination
  5. MFI marks receipt Claimed                      (loan closed)
     OR
  5. MFI marks receipt Defaulted                    (collateral seized)
```

Key design decisions:
- `activateReceipt()` combines status change + USDC transfer in one call
- The contract checks `WarehouseReceipt.approvedMfis(msg.sender)` for authorization
- `repayLoan()` is permissionless — anyone can repay on behalf of the farmer
- `markClaimed()` and `markDefaulted()` delegate to WarehouseReceipt calls

#### YieldVault

Simple deposit pool. Farmers deposit idle USDC; dashboard displays pool stats.

```
- deposit(amount): user deposits USDC, credits balance
- withdraw(amount): user withdraws USDC
- totalAssets(): total USDC in pool
- apy(): returns stored APY value (owner-set, simulating yield)
- balanceOf(user): user's deposit share
```

APY is owner-set (not oracled) for demo simplicity — avoids complex yield strategy. On mainnet this could connect to Aave or similar.

### Data Flow

```
                ┌──────────────────┐
                │   CropRegistry   │
                │  (crop defs)     │
                └────────┬─────────┘
                         │ validates crop
                         v
  ┌──────────────────────────────────────────┐
  │          WarehouseReceipt                 │
  │  tokenId -> farmer, agent, qty, status   │
  └────┬──────────────┬─────────────────────-┘
       │               │
       │ mints NFT     │ reads status
       v               v
  ┌──────────┐  ┌──────────────────┐
  │  Farmer  │  │ LoanOrigination │── USDC transfers
  │ holds NFT│  │ escrows USDC     │
  └──────────┘  └──────┬──────────-┘
                       │ deposits/withdraws
                       v
                ┌──────────────┐
                │  YieldVault   │
                │  (yield pool) │
                └──────────────┘
```

---

## 3. Frontend Changes

### New Files

| File | Purpose |
|---|---|
| `frontend/src/hooks/useMockUSDC.ts` | Balance, approve, transfer |
| `frontend/src/hooks/useLoanOrigination.ts` | Pool info, activate, repay, claim, default |
| `frontend/src/hooks/useYieldVault.ts` | Deposit, withdraw, balance, APY |
| `frontend/src/components/StatsBar.tsx` | 4-metric dashboard summary |
| `frontend/src/components/LoanCard.tsx` | Active/enabled loan status card |

### Modified Files

| File | Change |
|---|---|
| `frontend/src/config/contracts.ts` | Add MockUSDC, LoanOrigination, YieldVault ABIs + addresses |
| `frontend/src/app/page.tsx` | Remove mock data, wire live reads, add StatsBar + Loan sections + Yield section |

### Dashboard Layout (post-connect)

```
┌────────────────────────────────────────────────────────┐
│  AgriVault                                    [0x123...] │
├────────────────────────────────────────────────────────┤
│  Role Banner (Farmer/Agent/MFI)                        │
├────────────────────────────────────────────────────────┤
│  ┌────────┬─────────┬────────┬────────┐              │
│  │ $12.4K │   47    │ 3.2K   │ 8.2%   │              │
│  │  TVL   │ Loans   │ Mt      │ Yield  │              │
│  └────────┴─────────┴────────┴────────┘              │
├────────────────────────────────────────────────────────┤
│  My Receipts (3)                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ #1 Maize │ │ #2 Maize │ │ #3 Rice  │              │
│  │ Issued   │ │ Active   │ │ Issued   │              │
│  └──────────┘ └──────────┘ └──────────┘              │
├────────────────────────────────────────────────────────┤
│  Active Loans (1)             [FARMER]                │
│  ┌────────────────────────────────────────────────┐   │
│  │ #2 Maize — $250 USDC — Due Dec 15             │   │
│  │ [Repay]                                        │   │
│  └────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────┤
│  Pending Approvals (2)       [MFI]                    │
│  ┌────────────────────────────────────────────────┐   │
│  │ #1 Maize — 2000kg — Est. $100                │   │
│  │ [Activate Loan]                                 │   │
│  └────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────┤
│  Yield Pool                        [FARMER]           │
│  Pool: 3,200 USDC   APY: 8.2%                         │
│  Your deposit: 100 USDC                                │
│  [Deposit] [Withdraw]                                  │
└────────────────────────────────────────────────────────┘
```

### Role-Based Views

| Role | Sees |
|---|---|
| **Farmer** | StatsBar, My Receipts, Active Loans (with repayment), Yield Pool |
| **Agent** | StatsBar, Unverified Deposits (with issue-receipt form) |
| **MFI** | StatsBar, Pending Loan Approvals, Active Loans (with claim/default) |

### States Coverage

Each component handles:
- **Loading**: skeleton/spinner while contract data fetches
- **Empty**: clear message ("No receipts yet. Visit your local warehouse agent.")
- **Error**: inline error with retry where appropriate
- **Connected vs disconnected**: landing page with Connect Wallet
- **Wrong network**: prompt to switch to Avalanche Fuji

---

## 4. Testing

### Smart Contracts (~20 new tests)

| Contract | Tests | Focus |
|---|---|---|
| MockUSDC | 3 | Mint, transfer, decimals |
| LoanOrigination | 10 | Activate loan disburses USDC, repay, default, unauthorized access |
| YieldVault | 7 | Deposit, withdraw, balance tracking, owner-set APY |

### Frontend (if applicable)

- Manual testing on Fuji testnet with test AVAX + MockUSDC
- Verify each role sees correct views
- Verify write transactions (issue, activate, repay, claim, default) work end-to-end

---

## 5. Non-Functional Considerations

- **Zero-cost deployment on Fuji** — test AVAX from faucet covers gas
- **Frontend hosting** — Vercel free tier (static export)
- **Security** — LoanOrigination reuses WarehouseReceipt's auth (approvedMfis mapping), no new access-control surface; YieldVault is a simple escrow with no compounding logic (avoiding reentrancy concerns)
- **Mainnet readiness** — swap address in `contracts.ts` for real USDC, deploy contracts to C-chain mainnet, done

---

## 6. Roadmap Update

```
- [x] v1 MVP: CropRegistry + WarehouseReceipt with tri-party roles
- [x] Fuji testnet deployment
- [x] Frontend dashboard (mock data, role detection)
- [ ] LoanOrigination + YieldVault contracts
- [ ] MockUSDC deployment + frontend integration
- [ ] Live contract reads on dashboard (no mock data)
- [ ] Write flows (issue, activate, repay, claim, default)
- [ ] StatsBar, LoanCard, Yield Pool components
- [ ] Avalanche C-chain mainnet deployment
- [ ] Real USDC integration (mainnet)
- [ ] On-chain price oracle integration
- [ ] Mobile-friendly farmer dashboard
- [ ] Multi-commodity expansion (rice, coffee, cocoa)
```
