"use client";

import { type ReceiptData } from "@/config/contracts";
import { useCropDefinition } from "@/hooks/useCropRegistry";
import { StatusBadge } from "./StatusBadge";

/** Decode a bytes32 value that may contain a packed ASCII/UTF-8 string.
 *  Strips trailing null bytes; falls back to truncated hex on invalid encoding. */
function bytes32ToString(hex: `0x${string}`): string {
  try {
    const bytes = hex
      .slice(2)
      .match(/.{1,2}/g)
      ?.map((b) => parseInt(b, 16));
    if (!bytes) return hex.slice(0, 10);
    // Trim trailing null bytes
    const end = bytes.reduce((last, b, i) => (b !== 0 ? i + 1 : last), 0);
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes.slice(0, end)));
  } catch {
    return hex.slice(0, 10) + "…";
  }
}

function formatDate(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleDateString();
}

function formatUsd(val: bigint): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(val));
}

export function ReceiptCard({ receipt, cropName: propCropName }: { receipt: ReceiptData; cropName?: string }) {
  const { data: cropDef } = useCropDefinition(receipt.cropType);
  const cropName = propCropName ?? (cropDef ? (cropDef as { name: string }).name : bytes32ToString(receipt.cropType));

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs text-gray-400 font-mono">#{receipt.tokenId}</span>
          <h3 className="text-lg font-semibold text-gray-900">{cropName}</h3>
        </div>
        <StatusBadge status={receipt.status} />
      </div>

      <div className="space-y-1.5 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Quantity</span>
          <span className="font-medium text-gray-900">{receipt.quantityKg.toString()} kg</span>
        </div>
        <div className="flex justify-between">
          <span>Est. Value</span>
          <span className="font-medium text-gray-900">{formatUsd(receipt.estimatedValueUsd)}</span>
        </div>
        <div className="flex justify-between">
          <span>Quality</span>
          <span className="font-medium text-gray-900">{receipt.qualityScore.toString()}/100</span>
        </div>
        <div className="flex justify-between">
          <span>Expires</span>
          <span className="font-medium text-gray-900">{formatDate(receipt.expiryDate)}</span>
        </div>
        <div className="flex justify-between">
          <span>Warehouse</span>
          <span className="font-mono text-xs text-gray-500">{bytes32ToString(receipt.warehouseId)}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 font-mono truncate">
        Farmer: {receipt.farmer.slice(0, 6)}...{receipt.farmer.slice(-4)}
      </div>
    </div>
  );
}
