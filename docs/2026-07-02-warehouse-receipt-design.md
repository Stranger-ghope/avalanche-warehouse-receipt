# Digital Warehouse Receipt — Design Spec

## Overview

A smart contract system on Avalanche that issues "digital warehouse receipt" tokens representing harvested crops stored at verified warehouses. Each token acts as collateralized asset for micro-lending from local regulated Microfinance Institutions (MFIs). Pilot commodity: maize.

## Tri-Party Roles

| Role | Actor | Responsibility |
|---|---|---|
| Farmer | Asset Owner | Receives token upon depositing harvest |
| Warehouse Agent | Trusted Verifier | Physically inspects/inspects crops, signs off on volume and quality, issues token |
| MFI Manager | Lender | Reads token data on-chain to approve micro-loans against collateral |

## Core Contract: WarehouseReceipt

### Receipt Struct (Hybrid — Option C)

```solidity
struct WarehouseReceipt {
    // === Universal fields (all crops) ===
    uint256       id;              // Unique token ID
    address       farmer;          // Asset Owner — receives the token
    address       warehouseAgent;  // Trusted Verifier — signed the receipt
    address       mfi;             // Lender — MFI that will evaluate collateral
    uint256       quantityKg;      // Verified harvest volume in kilograms
    uint256       expiryDate;      // Collateral expiry — after this, token is invalid
    bytes32       warehouseId;     // Physical storage location identifier
    ReceiptStatus status;          // Issued → Active → Claimed / Defaulted / Expired

    // === On-chain summary (crop-agnostic, enough for MFI decision) ===
    bytes32       cropType;        // keccak256 commodity identifier (e.g. "MAIZE")
    uint256       estimatedValueUsd; // Computed by warehouse agent at issuance
    uint256       qualityScore;    // 0–100 composite (grade + moisture + defects)

    // === Off-chain detail (crop-specific, full inspection) ===
    string        metadataUri;     // IPFS URI with full inspection report
}
```

### ReceiptStatus Enum

```
Issued → Active → Claimed (farmer repaid)
               → Defaulted (MFI seizes)
               → Expired (passive expiry)
```

### Crop Registry (Extensibility)

A separate `CropRegistry` contract defines acceptable crop types and their parameters:

```solidity
struct CropDefinition {
    string   name;                 // Human-readable
    string[] metricKeys;           // e.g. ["moisture_content", "grade", "defect_rate"]
    uint256  minQualityScore;      // Minimum for MFI eligibility
    bool     active;               // Soft-disable a crop
}
```

The `issueReceipt()` function in the core contract validates that the supplied `cropType` exists and is `active` in the `CropRegistry` before minting. This prevents issuance of receipts for unrecognized or suspended commodities.

Adding a new commodity (rice, coffee, cocoa) requires only a new `CropDefinition` entry — no core contract changes.

## Data Flow

1. **Deposit** — Farmer delivers maize to warehouse. Warehouse Agent inspects the crop.
2. **Issue** — Warehouse Agent calls `issueReceipt(...)`, supplying universal fields + on-chain summary. Full inspection report is uploaded to IPFS, URI stored in `metadataUri`. Token is minted to the Farmer.
3. **Value Assessment** — MFI Manager reads `estimatedValueUsd`, `qualityScore`, `quantityKg`, and `expiryDate` on-chain. Optionally fetches full report from IPFS.
4. **Loan Approval** — MFI approves micro-loan based on the token's on-chain data.
5. **Repayment or Default** — Farmer repays → `Claimed`. Farmer defaults → MFI calls `markDefaulted()` → token ownership may transfer.
6. **Expiry** — Token auto-expires after `expiryDate` — no longer valid as collateral.

## On-Chain vs Off-Chain Breakdown

| Data | Location | Why |
|---|---|---|
| Farmer, Agent, MFI addresses | On-chain | Required for ownership and access control |
| Quantity, CropType, Expiry | On-chain | Core fields MFI reads for every loan decision |
| EstimatedValueUsd | On-chain | Primary lending metric — MFI needs this in-call |
| QualityScore (0–100) | On-chain | Quick risk assessment without off-chain fetch |
| Moisture content, grade, defect rate, photos | Off-chain (IPFS) | Detailed verification — only fetched for disputes or audits |

## Gas Optimization Notes

- `EstimatedValueUsd` and `QualityScore` are set once at issuance — no storage changes over lifetime.
- Metadata URI stored as string (not bytes) — easier for off-chain tools, variable-length overhead acceptable for infrequent writes.
- Status enum fits in a single uint8.
- Crop registry deployed separately — core contract references by `bytes32` key.

## Access Control

- **`onlyWarehouseAgent`** — can issue new receipts
- **`onlyApprovedMFI`** — can mark receipts as Claimed or Defaulted
- **`onlyFarmer`** — can view/transfer their own receipts
- Contract owner (timelock or multisig) can add/remove agents and MFIs

## Future-Proofing

- Adding a new crop: register new `CropDefinition` in `CropRegistry`.
- Adding new metric fields on-chain: deploy v2 of the core contract pointing to same registry.
- Cross-chain: Avalanche C-chain holds the token; a bridge or oracle could mint wrapped representations on other chains for liquidity.

## Out of Scope (v1)

- No lending pool or loan logic — the MFI integrates the token into its existing lending system.
- No on-chain price oracle — the Warehouse Agent estimates value based on local spot price.
- Token standard: ERC-721 for v1. Each receipt represents a unique deposit event (different quality scores, different timestamps). Batch operations are not a v1 requirement. ERC-1155 can be evaluated for v2 if gas costs or batch transfers become a concern.
