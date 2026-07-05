# AgriVault Landing Page Upgrade + Toast Notifications

**Date:** 2026-07-05
**Context:** Grant application submission, due tomorrow
**Scope:** Landing page redesign (disconnected state) + toast notifications for tx feedback

## Problem

The current landing page is a single hero with title, tagline, and Connect Wallet button on a blank background. For a grant application, this lacks credibility and product clarity. Evaluators need to understand the protocol quickly without connecting a wallet.

## Design

### 1. Landing Page (Disconnected State)

Replace the current minimal hero with four sections, all within the existing `page.tsx` disconnected state block.

**Hero Section**
- Subtle gradient background: `bg-gradient-to-b from-emerald-50 to-gray-50`
- Title: "AgriVault" (text-4xl, bold)
- Tagline: existing copy, max-w-lg centered
- Single Connect Wallet button (remove duplicate from navbar when disconnected)
- Below tagline: small text "Built on Avalanche" with Avalanche logo/badge

**How It Works (3-step cards)**
- Section title: "How It Works"
- Subtitle: "Three steps from harvest to liquidity"
- 3-column grid (responsive: 1-col mobile, 3-col desktop)
- Each card: icon (emoji), step number label, title, 1-2 sentence description
- Step 1: Deposit Harvest -- bring crop to warehouse agent
- Step 2: Get Receipt -- receive on-chain warehouse receipt as collateral
- Step 3: Access Loans -- borrow USDC from participating MFIs

**Protocol Stats**
- Section title: "Protocol Stats"
- Reuse existing StatsBar component (reads from on-chain data)
- Shows TVL, Active Loans, Receipts Issued, Yield APY
- Visible without wallet connection

**Bottom CTA**
- "Ready to get started?" heading
- Subtitle: "Connect your Avalanche wallet to access the protocol."
- Connect Wallet button
- Footer line: "Deployed on Avalanche Fuji Testnet" + Snowtrace link (reads contract address from `CONTRACT_ADDRESSES`)

**Navbar Change**
- When disconnected: show only the AgriVault logo + Avalanche badge (no Connect Wallet button)
- When connected: keep current layout (logo + address + disconnect)

### 2. Toast Notifications

**Library:** `sonner` (3KB, works with Next.js static export, no provider conflicts with wagmi)

**Integration:**
- Add `<Toaster />` to `providers.tsx` (or `layout.tsx`)
- Import `toast` from `sonner` in components that perform transactions

**Where toasts appear:**
- `IssueReceiptForm`: toast on submit (pending), success, or error
- `YieldSection`: toast on deposit/withdraw/approve (pending, success, error)
- `LoanCard`: toast on repay/mark-default (pending, success, error)

**Toast style:**
- Use default sonner styling (matches the clean aesthetic)
- Position: bottom-right
- Duration: 4s for success, persistent for errors

### 3. Form Labels

**IssueReceiptForm:**
- Add visible `<label>` elements above each input
- Labels: "Farmer Address", "Quantity (kg)", "Estimated Value (USD)", "Quality Score (0-100)"
- Style: small, gray, above the input field
- Keep placeholders as secondary hints

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/app/page.tsx` | Landing page sections, navbar conditional, form labels |
| `frontend/src/app/providers.tsx` | Add `<Toaster />` from sonner |
| `frontend/src/components/LoanCard.tsx` | Add toast on tx actions |
| `frontend/src/components/StatsBar.tsx` | No change (reused as-is) |
| `frontend/package.json` | Add `sonner` dependency |

## What's NOT in Scope

- No new routes or pages
- No new component files (all changes inline or to existing files)
- No animations beyond existing Tailwind transitions
- No mobile hamburger menu (not needed for single-page app)
- No i18n or accessibility overhaul
- No changes to dashboard/connected state layout

## Success Criteria

- Landing page shows How It Works, Stats, and CTA without wallet connection
- Toast notifications appear on transaction submit/success/failure
- Form inputs have visible labels
- No visual regressions in the connected dashboard state
- Build passes (`npm run build`)
