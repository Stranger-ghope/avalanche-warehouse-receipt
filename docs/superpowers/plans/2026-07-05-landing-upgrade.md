# AgriVault Landing Page Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the AgriVault landing page from a minimal hero to a polished grant-submission-ready page with How It Works, Protocol Stats, and CTA sections, plus add toast notifications for all transaction feedback.

**Architecture:** All changes are within existing files. The landing page sections are added inline in `page.tsx`'s disconnected state block. Toast notifications use the `sonner` library integrated via `providers.tsx`. No new component files are created.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS 3.4, wagmi v2, sonner (toast library)

---

### Task 1: Install sonner and add Toaster provider

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/app/providers.tsx`

- [ ] **Step 1: Install sonner**

Run from `frontend/`:
```bash
cd "D:/ALL WEBSITES/AVALANCHE/frontend" && npm install sonner
```
Expected: `sonner` added to dependencies in `package.json`

- [ ] **Step 2: Add Toaster to providers.tsx**

Open `frontend/src/app/providers.tsx`. Add the import and wrap children with `<Toaster />`:

```tsx
"use client";

import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "wagmi/connectors";
import { Toaster } from "sonner";

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
        <Toaster position="bottom-right" />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

- [ ] **Step 3: Verify build passes**

Run from `frontend/`:
```bash
cd "D:/ALL WEBSITES/AVALANCHE/frontend" && npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
cd "D:/ALL WEBSITES/AVALANCHE" && git add frontend/package.json frontend/package-lock.json frontend/src/app/providers.tsx && git commit -m "feat: add sonner toast provider"
```

---

### Task 2: Make Navbar conditionally show Connect Wallet

**Files:**
- Modify: `frontend/src/app/page.tsx:25-37` (Navbar function)

- [ ] **Step 1: Update Navbar to accept isConnected prop**

Replace the entire `Navbar` function in `page.tsx` (lines 25-37) with:

```tsx
function Navbar({ isConnected }: { isConnected: boolean }) {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-emerald-700">AgriVault</span>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Avalanche</span>
        </div>
        {isConnected ? <LoginButton /> : <div />}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Update Navbar call site in Dashboard component**

In the `Dashboard` function (around line 331), change `<Navbar />` to `<Navbar isConnected={isConnected} />`:

```tsx
export default function Dashboard() {
  const { isConnected, address } = useAccount();
  const { role, isLoading } = useRole();
  const { data: totalSupply } = useTotalSupply();

  const supplyCount = Number(totalSupply ?? 0);
  const tokenIds = Array.from({ length: supplyCount }, (_, i) => i);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar isConnected={isConnected} />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
```

- [ ] **Step 3: Verify build passes**

Run from `frontend/`:
```bash
cd "D:/ALL WEBSITES/AVALANCHE/frontend" && npm run build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd "D:/ALL WEBSITES/AVALANCHE" && git add frontend/src/app/page.tsx && git commit -m "feat: conditionally hide Connect Wallet in navbar when disconnected"
```

---

### Task 3: Build landing page sections (Hero, How It Works, Stats, CTA)

**Files:**
- Modify: `frontend/src/app/page.tsx:333-341` (disconnected state block)

- [ ] **Step 1: Replace the disconnected state block**

In `page.tsx`, find the disconnected state block (lines 333-341):

```tsx
        {!isConnected ? (
          <div className="text-center py-24">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">AgriVault</h1>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Digital warehouse receipts on Avalanche. Bypassing Malawi&apos;s forex shortage with
              stablecoin-collateralized micro-loans for smallholder farmers.
            </p>
            <LoginButton />
          </div>
```

Replace with:

```tsx
        {!isConnected ? (
          <>
            {/* Hero */}
            <div className="text-center py-20 bg-gradient-to-b from-emerald-50 to-gray-50 -mx-4 px-4 rounded-2xl">
              <h1 className="text-4xl font-bold text-gray-900 mb-3">AgriVault</h1>
              <p className="text-gray-500 mb-6 max-w-lg mx-auto leading-relaxed">
                Digital warehouse receipts on Avalanche. Bypassing Malawi&apos;s forex shortage with
                stablecoin-collateralized micro-loans for smallholder farmers.
              </p>
              <LoginButton />
              <p className="mt-6 text-xs text-gray-400">
                Built on{" "}
                <span className="font-medium text-emerald-600">Avalanche</span>
              </p>
            </div>

            {/* How It Works */}
            <div className="py-12">
              <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">How It Works</h2>
              <p className="text-gray-500 text-center mb-10">Three steps from harvest to liquidity</p>
              <div className="grid gap-8 md:grid-cols-3">
                {[
                  {
                    icon: "\u{1F33E}",
                    step: "Step 1",
                    title: "Deposit Harvest",
                    desc: "Bring your crop to a verified warehouse agent for inspection and storage.",
                  },
                  {
                    icon: "\u{1F4C4}",
                    step: "Step 2",
                    title: "Get Receipt",
                    desc: "Receive an on-chain warehouse receipt as digital collateral for your stored harvest.",
                  },
                  {
                    icon: "\u{1F4B0}",
                    step: "Step 3",
                    title: "Access Loans",
                    desc: "Use your receipt as collateral to borrow USDC stablecoins from participating MFIs.",
                  },
                ].map((s) => (
                  <div key={s.step} className="text-center">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3 text-2xl">
                      {s.icon}
                    </div>
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">
                      {s.step}
                    </p>
                    <h3 className="font-semibold text-gray-900 mb-1">{s.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Protocol Stats */}
            <div className="py-8">
              <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">Protocol Stats</h2>
              <StatsBar />
            </div>

            {/* Bottom CTA */}
            <div className="py-12 text-center border-t border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Ready to get started?</h2>
              <p className="text-gray-500 mb-6">
                Connect your Avalanche wallet to access the protocol.
              </p>
              <LoginButton />
              <p className="mt-6 text-xs text-gray-400">
                Deployed on Avalanche Fuji Testnet &middot;{" "}
                <a
                  href={`https://testnet.snowtrace.io/address/${CONTRACT_ADDRESSES.warehouseReceipt}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-600"
                >
                  View Contracts on Snowtrace
                </a>
              </p>
            </div>
          </>
```

- [ ] **Step 2: Verify build passes**

Run from `frontend/`:
```bash
cd "D:/ALL WEBSITES/AVALANCHE/frontend" && npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd "D:/ALL WEBSITES/AVALANCHE" && git add frontend/src/app/page.tsx && git commit -m "feat: add landing page sections - hero, how it works, stats, CTA"
```

---

### Task 4: Add form labels to IssueReceiptForm

**Files:**
- Modify: `frontend/src/app/page.tsx:175-218` (IssueReceiptForm return JSX)

- [ ] **Step 1: Update IssueReceiptForm JSX with labels**

In `page.tsx`, find the IssueReceiptForm return block (lines 175-218). Replace the entire return statement's JSX with:

```tsx
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">Issue New Receipt</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Farmer Address</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="0x..."
            value={farmer}
            onChange={(e) => setFarmer(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Quantity (kg)</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. 500"
            type="number"
            value={quantityKg}
            onChange={(e) => setQuantityKg(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Estimated Value (USD)</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. 1200"
            type="number"
            value={estValue}
            onChange={(e) => setEstValue(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Quality Score (0-100)</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="75"
            type="number"
            min={0}
            max={100}
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
          />
        </div>
      </div>
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !farmer || !quantityKg || !estValue}
        className="w-full px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 text-sm"
      >
        {isSubmitting ? "Submitting..." : "Issue Receipt"}
      </button>
    </div>
  );
```

- [ ] **Step 2: Verify build passes**

Run from `frontend/`:
```bash
cd "D:/ALL WEBSITES/AVALANCHE/frontend" && npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd "D:/ALL WEBSITES/AVALANCHE" && git add frontend/src/app/page.tsx && git commit -m "feat: add visible form labels to IssueReceiptForm"
```

---

### Task 5: Add toast notifications to IssueReceiptForm and YieldSection

**Files:**
- Modify: `frontend/src/app/page.tsx:141-173` (IssueReceiptForm handleSubmit)
- Modify: `frontend/src/app/page.tsx:236-267` (YieldSection handlers)

- [ ] **Step 1: Add toast import to page.tsx**

At the top of `page.tsx`, add the sonner import after the existing imports (after line 21):

```tsx
import { toast } from "sonner";
```

- [ ] **Step 2: Add toast to IssueReceiptForm handleSubmit**

Replace the `handleSubmit` function in IssueReceiptForm (lines 141-173) with:

```tsx
  const handleSubmit = useCallback(async () => {
    if (!farmer || !quantityKg || !estValue) return;
    setIsSubmitting(true);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 60;
    const ts = Date.now().toString(16).padStart(2, "0");
    const warehouseId = ("0x" + ts.padEnd(64, "0")) as `0x${string}`;

    toast.loading("Submitting receipt...", { id: "issue-receipt" });

    writeContract({
      address: CONTRACT_ADDRESSES.warehouseReceipt,
      abi: WAREHOUSE_RECEIPT_WRITE_ABI,
      functionName: "issueReceipt",
      args: [
        farmer as `0x${string}`,
        BigInt(quantityKg),
        BigInt(expiry),
        warehouseId,
        CROP_BYTES32 as `0x${string}`,
        BigInt(Math.round(parseFloat(estValue) * 1_000_000)),
        BigInt(quality),
        "ipfs://QmPlaceholder",
      ],
      onSuccess: () => {
        toast.success("Receipt issued successfully!", { id: "issue-receipt" });
        setFarmer("");
        setQuantityKg("");
        setEstValue("");
        setQuality("75");
        setIsSubmitting(false);
        queryClient.invalidateQueries();
        onIssued();
      },
      onError: (error) => {
        toast.error(`Transaction failed: ${error.message.slice(0, 80)}`, { id: "issue-receipt" });
        setIsSubmitting(false);
      },
    });
  }, [farmer, quantityKg, estValue, quality, writeContract, queryClient, onIssued]);
```

- [ ] **Step 3: Add toast to YieldSection handlers**

In the YieldSection function, update the three handlers. Replace `handleDeposit`, `handleApprove`, and `handleWithdraw` (lines 236-267) with:

```tsx
  const handleDeposit = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    const depositAmount = BigInt(Math.round(parseFloat(amount) * 1_000_000));
    toast.loading("Depositing to yield pool...", { id: "yield-deposit" });
    writeContract({
      address: YIELD_VAULT_ADDRESS,
      abi: YIELD_VAULT_ABI,
      functionName: "deposit",
      args: [depositAmount],
      onSuccess: () => {
        toast.success("Deposit successful!", { id: "yield-deposit" });
        setAmount("");
        queryClient.invalidateQueries();
      },
      onError: (error) => {
        toast.error(`Deposit failed: ${error.message.slice(0, 80)}`, { id: "yield-deposit" });
      },
    });
  };

  const handleApprove = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    const depositAmount = BigInt(Math.round(parseFloat(amount) * 1_000_000));
    toast.loading("Approving USDC...", { id: "yield-approve" });
    writeContract({
      address: MOCK_USDC_ADDRESS,
      abi: MOCK_USDC_ABI,
      functionName: "approve",
      args: [YIELD_VAULT_ADDRESS, depositAmount],
      onSuccess: () => {
        toast.success("USDC approved!", { id: "yield-approve" });
        queryClient.invalidateQueries();
      },
      onError: (error) => {
        toast.error(`Approval failed: ${error.message.slice(0, 80)}`, { id: "yield-approve" });
      },
    });
  };

  const handleWithdraw = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    const withdrawAmount = BigInt(Math.round(parseFloat(amount) * 1_000_000));
    toast.loading("Withdrawing from yield pool...", { id: "yield-withdraw" });
    writeContract({
      address: YIELD_VAULT_ADDRESS,
      abi: YIELD_VAULT_ABI,
      functionName: "withdraw",
      args: [withdrawAmount],
      onSuccess: () => {
        toast.success("Withdrawal successful!", { id: "yield-withdraw" });
        setAmount("");
        queryClient.invalidateQueries();
      },
      onError: (error) => {
        toast.error(`Withdrawal failed: ${error.message.slice(0, 80)}`, { id: "yield-withdraw" });
      },
    });
  };
```

- [ ] **Step 4: Verify build passes**

Run from `frontend/`:
```bash
cd "D:/ALL WEBSITES/AVALANCHE/frontend" && npm run build
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
cd "D:/ALL WEBSITES/AVALANCHE" && git add frontend/src/app/page.tsx && git commit -m "feat: add toast notifications to IssueReceiptForm and YieldSection"
```

---

### Task 6: Add toast notifications to LoanCard

**Files:**
- Modify: `frontend/src/components/LoanCard.tsx:1-5` (imports)
- Modify: `frontend/src/components/LoanCard.tsx:40-75` (handler functions)

- [ ] **Step 1: Add toast import to LoanCard.tsx**

Add the sonner import after line 5 in `LoanCard.tsx`:

```tsx
import { toast } from "sonner";
```

- [ ] **Step 2: Add toast to handleActivate**

Replace the `handleActivate` function (lines 40-47) with:

```tsx
  const handleActivate = () => {
    toast.loading("Activating loan...", { id: "loan-activate" });
    writeActivate({
      address: LOAN_ORIGINATION_ADDRESS,
      abi: LOAN_ORIGINATION_ABI,
      functionName: "activateLoan",
      args: [BigInt(receipt.tokenId)],
      onSuccess: () => {
        toast.success("Loan activated!", { id: "loan-activate" });
      },
      onError: (error) => {
        toast.error(`Activation failed: ${error.message.slice(0, 80)}`, { id: "loan-activate" });
      },
    });
  };
```

- [ ] **Step 3: Add toast to handleRepay**

Replace the `handleRepay` function (lines 49-66) with:

```tsx
  const handleRepay = () => {
    const repayAmount = BigInt(receipt.estimatedValueUsd);
    if (!allowance || allowance < repayAmount) {
      toast.loading("Approving USDC for repayment...", { id: "loan-repay" });
      writeApprove({
        address: MOCK_USDC_ADDRESS,
        abi: MOCK_USDC_ABI,
        functionName: "approve",
        args: [LOAN_ORIGINATION_ADDRESS, repayAmount],
        onSuccess: () => {
          toast.success("USDC approved! Click Repay again to complete.", { id: "loan-repay" });
        },
        onError: (error) => {
          toast.error(`Approval failed: ${error.message.slice(0, 80)}`, { id: "loan-repay" });
        },
      });
    } else {
      toast.loading("Repaying loan...", { id: "loan-repay" });
      writeLoanRepay({
        address: LOAN_ORIGINATION_ADDRESS,
        abi: LOAN_ORIGINATION_ABI,
        functionName: "repayLoan",
        args: [BigInt(receipt.tokenId)],
        onSuccess: () => {
          toast.success("Loan repaid!", { id: "loan-repay" });
        },
        onError: (error) => {
          toast.error(`Repayment failed: ${error.message.slice(0, 80)}`, { id: "loan-repay" });
        },
      });
    }
  };
```

- [ ] **Step 4: Add toast to handleDefault**

Replace the `handleDefault` function (lines 68-75) with:

```tsx
  const handleDefault = () => {
    toast.loading("Marking loan as defaulted...", { id: "loan-default" });
    writeDefault({
      address: LOAN_ORIGINATION_ADDRESS,
      abi: LOAN_ORIGINATION_ABI,
      functionName: "defaultLoan",
      args: [BigInt(receipt.tokenId)],
      onSuccess: () => {
        toast.success("Loan marked as defaulted.", { id: "loan-default" });
      },
      onError: (error) => {
        toast.error(`Default failed: ${error.message.slice(0, 80)}`, { id: "loan-default" });
      },
    });
  };
```

- [ ] **Step 5: Verify build passes**

Run from `frontend/`:
```bash
cd "D:/ALL WEBSITES/AVALANCHE/frontend" && npm run build
```
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
cd "D:/ALL WEBSITES/AVALANCHE" && git add frontend/src/components/LoanCard.tsx && git commit -m "feat: add toast notifications to LoanCard transactions"
```

---

### Task 7: Final build verification and cleanup

**Files:**
- Verify: all modified files

- [ ] **Step 1: Full production build**

Run from `frontend/`:
```bash
cd "D:/ALL WEBSITES/AVALANCHE/frontend" && npm run build
```
Expected: Build succeeds with no errors or warnings related to our changes.

- [ ] **Step 2: Verify no regressions in connected state**

Manually verify (or review code) that the Dashboard component still renders correctly when connected:
- RoleBanner renders
- StatsBar renders
- SectionCard renders
- IssueReceiptForm renders with labels
- YieldSection renders with toasts
- LoanCard renders with toasts

- [ ] **Step 3: Final commit (if any cleanup needed)**

If any small fixes were needed during verification:
```bash
cd "D:/ALL WEBSITES/AVALANCHE" && git add -A && git commit -m "fix: final cleanup for landing page upgrade"
```
