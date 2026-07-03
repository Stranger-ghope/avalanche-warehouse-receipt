"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { LOAN_ORIGINATION_ABI, CONTRACT_ADDRESSES } from "@/config/contracts";

export const LOAN_ORIGINATION_ADDRESS = CONTRACT_ADDRESSES.loanOrigination;

export function useLoanInfo(tokenId: number | undefined) {
  return useReadContract({
    address: LOAN_ORIGINATION_ADDRESS,
    abi: LOAN_ORIGINATION_ABI,
    functionName: "loans",
    args: tokenId !== undefined ? [BigInt(tokenId)] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useIsAuthorizedMfi(address: `0x${string}` | undefined) {
  return useReadContract({
    address: LOAN_ORIGINATION_ADDRESS,
    abi: LOAN_ORIGINATION_ABI,
    functionName: "authorizedMfis",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useActiveLoanCount() {
  return useReadContract({
    address: LOAN_ORIGINATION_ADDRESS,
    abi: LOAN_ORIGINATION_ABI,
    functionName: "activeLoanCount",
  });
}

export function usePoolBalance() {
  return useReadContract({
    address: LOAN_ORIGINATION_ADDRESS,
    abi: LOAN_ORIGINATION_ABI,
    functionName: "poolBalance",
  });
}

export function useActivateLoan() {
  return useWriteContract();
}

export function useRepayLoan() {
  return useWriteContract();
}

export function useDefaultLoan() {
  return useWriteContract();
}
