"use client";

import { useAccount } from "wagmi";
import { LoginButton } from "@/components/LoginButton";
import { ReceiptCard } from "@/components/ReceiptCard";
import { useRole } from "@/hooks/useRole";
import { RECEIPT_STATUS, type ReceiptData } from "@/config/contracts";

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
            <FarmerSection receipts={allReceipts} />
            {role === "agent" && <AgentSection receipts={allReceipts} />}
            {role === "mfi" && <MfiSection receipts={allReceipts} />}
          </>
        )}
      </main>
    </div>
  );
}
