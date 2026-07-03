"use client";

import { useAccount } from "wagmi";
import { type ReceiptData, LOAN_ORIGINATION_ABI, MOCK_USDC_ABI } from "@/config/contracts";
import { StatusBadge } from "./StatusBadge";
import {
  LOAN_ORIGINATION_ADDRESS,
  useLoanInfo,
  useActivateLoan,
  useRepayLoan,
  useDefaultLoan,
} from "@/hooks/useLoanOrigination";
import { MOCK_USDC_ADDRESS, useUSDCAllowance, useUSDCApprove } from "@/hooks/useMockUSDC";

function formatUsd(val: bigint): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(val) / 1_000_000
  );
}

interface LoanCardProps {
  receipt: ReceiptData;
  role: string;
}

export function LoanCard({ receipt, role }: LoanCardProps) {
  const { address } = useAccount();
  const { data: loanInfo } = useLoanInfo(receipt.tokenId);
  const { data: allowance } = useUSDCAllowance(address, LOAN_ORIGINATION_ADDRESS);

  const { writeContract: writeActivate } = useActivateLoan();
  const { writeContract: writeApprove } = useUSDCApprove();
  const { writeContract: writeLoanRepay } = useRepayLoan();
  const { writeContract: writeDefault } = useDefaultLoan();

  const loanInfoArr = loanInfo as readonly [string, bigint, string, boolean] | undefined;
  const isActive = loanInfoArr?.[3] ?? false;
  const loanAmount = loanInfoArr?.[1] ?? 0n;

  const handleActivate = () => {
    writeActivate({
      address: LOAN_ORIGINATION_ADDRESS,
      abi: LOAN_ORIGINATION_ABI,
      functionName: "activateLoan",
      args: [BigInt(receipt.tokenId)],
    });
  };

  const handleRepay = () => {
    const repayAmount = BigInt(receipt.estimatedValueUsd);
    if (!allowance || allowance < repayAmount) {
      writeApprove({
        address: MOCK_USDC_ADDRESS,
        abi: MOCK_USDC_ABI,
        functionName: "approve",
        args: [LOAN_ORIGINATION_ADDRESS, repayAmount],
      });
    } else {
      writeLoanRepay({
        address: LOAN_ORIGINATION_ADDRESS,
        abi: LOAN_ORIGINATION_ABI,
        functionName: "repayLoan",
        args: [BigInt(receipt.tokenId)],
      });
    }
  };

  const handleDefault = () => {
    writeDefault({
      address: LOAN_ORIGINATION_ADDRESS,
      abi: LOAN_ORIGINATION_ABI,
      functionName: "defaultLoan",
      args: [BigInt(receipt.tokenId)],
    });
  };

  if (!isActive) return null;

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs text-gray-400 font-mono">#{receipt.tokenId}</span>
          <h3 className="text-lg font-semibold text-gray-900">Crop Loan</h3>
        </div>
        <StatusBadge status={receipt.status} />
      </div>

      <div className="space-y-1.5 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Loan Amount</span>
          <span className="font-medium text-gray-900">{formatUsd(loanAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Collateral</span>
          <span className="font-medium text-gray-900">{receipt.quantityKg.toString()} kg</span>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {role === "farmer" && (
          <button
            onClick={handleRepay}
            className="flex-1 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            Repay Loan
          </button>
        )}
        {role === "mfi" && (
          <button
            onClick={handleDefault}
            className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Mark Default
          </button>
        )}
      </div>
    </div>
  );
}
