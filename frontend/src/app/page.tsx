"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { LoginButton } from "@/components/LoginButton";
import { ReceiptCard } from "@/components/ReceiptCard";
import { StatsBar } from "@/components/StatsBar";
import { LoanCard } from "@/components/LoanCard";
import { useRole } from "@/hooks/useRole";
import { useReceipt, useTotalSupply, useOwnerOf } from "@/hooks/useWarehouseReceipt";
import { useVaultBalance, useVaultTotalAssets, useVaultApy, YIELD_VAULT_ADDRESS } from "@/hooks/useYieldVault";
import { MOCK_USDC_ADDRESS, useUSDCBalance, useUSDCAllowance } from "@/hooks/useMockUSDC";
import {
  WAREHOUSE_RECEIPT_WRITE_ABI,
  CONTRACT_ADDRESSES,
  YIELD_VAULT_ABI,
  MOCK_USDC_ABI,
  type ReceiptData,
} from "@/config/contracts";
import { useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─── Navbar ──────────────────────────────────────────────────

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

// ─── Role Banner ─────────────────────────────────────────────

function RoleBanner({ role }: { role: string }) {
  const banners: Record<string, { emoji: string; title: string; desc: string; next: string }> = {
    agent: {
      emoji: "\u{1F3DB}️",
      title: "Warehouse Agent",
      desc: "Inspect deposits and issue warehouse receipts to farmers.",
      next: "Issue a receipt for a farmer’s deposit using the form below.",
    },
    mfi: {
      emoji: "\u{1F3E6}",
      title: "MFI Manager",
      desc: "Activate loans, monitor repayments, and manage risk.",
      next: "Review Issued receipts and activate loans to disburse USDC to farmers.",
    },
    farmer: {
      emoji: "\u{1F33E}",
      title: "Farmer",
      desc: "Your receipts serve as on-chain collateral for USDC loans.",
      next: "Your receipts appear below. Use them as collateral to get a loan, or deposit USDC in the Yield Pool.",
    },
    unverified: {
      emoji: "\u{1F464}",
      title: "Unverified",
      desc: "Connect your wallet and register as a participant.",
      next: "Ask the contract owner to register your address as a participant.",
    },
  };
  const b = banners[role] ?? banners.unverified;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
      <span className="text-3xl">{b.emoji}</span>
      <div>
        <h2 className="font-semibold text-gray-900">{b.title}</h2>
        <p className="text-sm text-gray-500">{b.desc}</p>
        <p className="text-xs text-gray-400 mt-1">{b.next}</p>
      </div>
    </div>
  );
}

// ─── Section / Empty State / Skeleton ────────────────────────

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

function SkeletonCard() {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

// ─── ReceiptById (wraps ReceiptCard with live data fetch) ─────

function ReceiptById({ tokenId, filterMode, userAddress }: {
  tokenId: number;
  filterMode?: "all" | "mine" | "issued" | "active";
  userAddress?: `0x${string}`;
}) {
  const { data, isLoading, isError } = useReceipt(tokenId);
  const { data: owner } = filterMode === "mine" ? useOwnerOf(tokenId) : { data: undefined };

  if (isLoading) return <SkeletonCard />;
  if (isError || !data) return null;

  const receipt: ReceiptData = { ...(data as Omit<ReceiptData, "tokenId">), tokenId };

  if (filterMode === "mine" && (!userAddress || owner !== userAddress)) return null;
  if (filterMode === "issued" && receipt.status !== 0) return null;
  if (filterMode === "active" && receipt.status !== 1) return null;

  return <ReceiptCard receipt={receipt} />;
}

// ─── LoanCardById (wraps LoanCard with live data fetch) ──────

function LoanCardById({ tokenId, role }: { tokenId: number; role: string }) {
  const { data, isLoading, isError } = useReceipt(tokenId);
  if (isLoading || isError || !data) return null;
  const receipt: ReceiptData = { ...(data as Omit<ReceiptData, "tokenId">), tokenId };
  return <LoanCard receipt={receipt} role={role} />;
}

// ─── Issue Receipt Form (Agent) ───────────────────────────────

const CROP_BYTES32 = "0x3ce99a310939eb07482918d72156c761c02af23e235ffdecff9fb8499f891089";

function IssueReceiptForm({ onIssued }: { onIssued: () => void }) {
  const { writeContract } = useWriteContract();
  const queryClient = useQueryClient();
  const [farmer, setFarmer] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [estValue, setEstValue] = useState("");
  const [quality, setQuality] = useState("75");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!farmer || !quantityKg || !estValue) return;
    setIsSubmitting(true);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 60;
    const ts = Date.now().toString(16).padStart(2, "0");
    const warehouseId = ("0x" + ts.padEnd(64, "0")) as `0x${string}`;

    toast.loading("Submitting receipt...", { id: "issue-receipt" });

    writeContract(
      {
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
      },
      {
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
      },
    );
  }, [farmer, quantityKg, estValue, quality, writeContract, queryClient, onIssued]);

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
}

// ─── Yield Pool Section ──────────────────────────────────────

function YieldSection({ address }: { address: `0x${string}` }) {
  const { writeContract } = useWriteContract();
  const { data: userBalance } = useVaultBalance(address);
  const { data: totalAssets } = useVaultTotalAssets();
  const { data: apyBps } = useVaultApy();
  const { data: usdcBalance } = useUSDCBalance(address);
  const { data: allowance } = useUSDCAllowance(address, YIELD_VAULT_ADDRESS);
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");

  const apyPct = apyBps !== undefined ? (Number(apyBps) / 100).toFixed(1) : "—";
  const userBal = userBalance ? (Number(userBalance) / 1_000_000).toFixed(2) : "0.00";
  const totalBal = totalAssets ? (Number(totalAssets) / 1_000_000).toFixed(2) : "0.00";
  const walletBal = usdcBalance ? (Number(usdcBalance) / 1_000_000).toFixed(2) : "0.00";

  const handleDeposit = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    const depositAmount = BigInt(Math.round(parseFloat(amount) * 1_000_000));
    toast.loading("Depositing to yield pool...", { id: "yield-deposit" });
    writeContract(
      {
        address: YIELD_VAULT_ADDRESS,
        abi: YIELD_VAULT_ABI,
        functionName: "deposit",
        args: [depositAmount],
      },
      {
        onSuccess: () => {
          toast.success("Deposit successful!", { id: "yield-deposit" });
          setAmount("");
          queryClient.invalidateQueries();
        },
        onError: (error) => {
          toast.error(`Deposit failed: ${error.message.slice(0, 80)}`, { id: "yield-deposit" });
        },
      },
    );
  };

  const handleApprove = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    const depositAmount = BigInt(Math.round(parseFloat(amount) * 1_000_000));
    toast.loading("Approving USDC...", { id: "yield-approve" });
    writeContract(
      {
        address: MOCK_USDC_ADDRESS,
        abi: MOCK_USDC_ABI,
        functionName: "approve",
        args: [YIELD_VAULT_ADDRESS, depositAmount],
      },
      {
        onSuccess: () => {
          toast.success("USDC approved!", { id: "yield-approve" });
          queryClient.invalidateQueries();
        },
        onError: (error) => {
          toast.error(`Approval failed: ${error.message.slice(0, 80)}`, { id: "yield-approve" });
        },
      },
    );
  };

  const handleWithdraw = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    const withdrawAmount = BigInt(Math.round(parseFloat(amount) * 1_000_000));
    toast.loading("Withdrawing from yield pool...", { id: "yield-withdraw" });
    writeContract(
      {
        address: YIELD_VAULT_ADDRESS,
        abi: YIELD_VAULT_ABI,
        functionName: "withdraw",
        args: [withdrawAmount],
      },
      {
        onSuccess: () => {
          toast.success("Withdrawal successful!", { id: "yield-withdraw" });
          setAmount("");
          queryClient.invalidateQueries();
        },
        onError: (error) => {
          toast.error(`Withdrawal failed: ${error.message.slice(0, 80)}`, { id: "yield-withdraw" });
        },
      },
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Yield Pool</h3>
        <span className="text-sm text-emerald-600 font-medium">{apyPct}% APY</span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-gray-500">Pool</p>
          <p className="text-lg font-semibold text-gray-900">{totalBal} USDC</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-gray-500">Your Deposit</p>
          <p className="text-lg font-semibold text-gray-900">{userBal} USDC</p>
        </div>
      </div>

      <p className="text-xs text-gray-400">Wallet: {walletBal} USDC</p>

      <div className="flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Amount (USDC)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {!allowance || (amount && allowance < BigInt(Math.round(parseFloat(amount) * 1_000_000))) ? (
          <button onClick={handleApprove}
            className="px-4 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition">
            Approve USDC
          </button>
        ) : (
          <button onClick={handleDeposit}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
            Deposit
          </button>
        )}
        <button
          onClick={handleWithdraw}
          className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition"
        >
          Withdraw
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────

export default function Dashboard() {
  const { isConnected, address } = useAccount();
  const { role, isLoading } = useRole();
  const { data: totalSupply } = useTotalSupply();
  const [showContracts, setShowContracts] = useState(false);

  const supplyCount = Number(totalSupply ?? 0);
  const tokenIds = Array.from({ length: supplyCount }, (_, i) => i);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar isConnected={isConnected} />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
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
                <button
                  onClick={() => setShowContracts(!showContracts)}
                  className="underline hover:text-gray-600 cursor-pointer"
                >
                  View Contracts on Snowtrace
                </button>
              </p>
              {showContracts && (
                <div className="mt-3 text-xs text-gray-400 space-y-1">
                  {Object.entries(CONTRACT_ADDRESSES).map(([name, addr]) => (
                    <div key={name}>
                      <a
                        href={`https://testnet.snowtrace.io/address/${addr}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-gray-600"
                      >
                        {name}: {addr.slice(0, 6)}...{addr.slice(-4)}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : isLoading ? (
          <div className="text-center py-24 text-gray-400">Loading your role...</div>
        ) : (
          <>
            <RoleBanner role={role} />
            <StatsBar />

            {/* Farmer: My Receipts */}
            <SectionCard title="My Receipts" count={supplyCount}>
              {supplyCount === 0 ? (
                <EmptyState message="No receipts yet. Visit a warehouse agent to deposit your harvest." />
              ) : (
                tokenIds.map((id) => (
                  <ReceiptById key={id} tokenId={id} filterMode="mine" userAddress={address} />
                ))
              )}
            </SectionCard>

            {/* Agent: Unverified Deposits + Issue Form */}
            {role === "agent" && (
              <>
                <SectionCard title="Unverified Deposits" count={supplyCount}>
                  {supplyCount === 0 ? (
                    <EmptyState message="No pending deposits." />
                  ) : (
                    tokenIds.map((id) => <ReceiptById key={id} tokenId={id} filterMode="issued" />)
                  )}
                </SectionCard>
                <IssueReceiptForm onIssued={() => {}} />
              </>
            )}

            {/* MFI: Pending Approvals */}
            {role === "mfi" && (
              <SectionCard title="Pending Loan Approvals" count={supplyCount}>
                {supplyCount === 0 ? (
                  <EmptyState message="No receipts waiting for approval." />
                ) : (
                  tokenIds.map((id) => <ReceiptById key={id} tokenId={id} filterMode="issued" />)
                )}
              </SectionCard>
            )}

            {/* Active Loans */}
            {tokenIds.length > 0 && (
              <SectionCard title="Active Loans" count={tokenIds.length}>
                {tokenIds.map((id) => (
                  <LoanCardById key={id} tokenId={id} role={role} />
                ))}
              </SectionCard>
            )}

            {/* Yield Pool (farmers) */}
            {role === "farmer" && address && <YieldSection address={address} />}
          </>
        )}
      </main>
    </div>
  );
}
