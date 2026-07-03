"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { YIELD_VAULT_ABI, CONTRACT_ADDRESSES } from "@/config/contracts";

export const YIELD_VAULT_ADDRESS = CONTRACT_ADDRESSES.yieldVault;

export function useVaultBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: YIELD_VAULT_ADDRESS,
    abi: YIELD_VAULT_ABI,
    functionName: "balances",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useVaultTotalAssets() {
  return useReadContract({
    address: YIELD_VAULT_ADDRESS,
    abi: YIELD_VAULT_ABI,
    functionName: "totalAssets",
  });
}

export function useVaultApy() {
  return useReadContract({
    address: YIELD_VAULT_ADDRESS,
    abi: YIELD_VAULT_ABI,
    functionName: "apyBps",
  });
}

export function useVaultDeposit() {
  return useWriteContract();
}

export function useVaultWithdraw() {
  return useWriteContract();
}
