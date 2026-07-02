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
