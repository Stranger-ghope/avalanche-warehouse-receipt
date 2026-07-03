"use client";

import { useTotalSupply } from "@/hooks/useWarehouseReceipt";
import { useActiveLoanCount, usePoolBalance } from "@/hooks/useLoanOrigination";
import { useVaultTotalAssets, useVaultApy } from "@/hooks/useYieldVault";

function formatUsd(val: bigint | undefined): string {
  if (val === undefined) return "—";
  const formatted = Number(val) / 1_000_000;
  if (formatted >= 1000) return "$" + (formatted / 1000).toFixed(1) + "K";
  if (formatted >= 1) return "$" + formatted.toFixed(2);
  return "$" + formatted.toFixed(4);
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">
        {value}
        {suffix && <span className="text-sm font-normal text-gray-500 ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

export function StatsBar() {
  const { data: totalSupply } = useTotalSupply();
  const { data: activeLoans } = useActiveLoanCount();
  const { data: poolBalance } = usePoolBalance();
  const { data: vaultTotal } = useVaultTotalAssets();
  const { data: apyBps } = useVaultApy();

  const loanPoolBalance = poolBalance ?? 0n;
  const yieldPoolBalance = vaultTotal ?? 0n;
  const totalVaultLocked = loanPoolBalance + yieldPoolBalance;

  const apyPct = apyBps !== undefined ? (Number(apyBps) / 100).toFixed(1) : "—";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Total Value Locked" value={formatUsd(totalVaultLocked)} />
      <StatCard label="Active Loans" value={activeLoans?.toString() ?? "0"} />
      <StatCard label="Receipts Issued" value={totalSupply?.toString() ?? "0"} />
      <StatCard label="Yield APY" value={apyPct} suffix="%" />
    </div>
  );
}
