"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { MOCK_USDC_ABI, CONTRACT_ADDRESSES } from "@/config/contracts";

export const MOCK_USDC_ADDRESS = CONTRACT_ADDRESSES.mockUSDC;

export function useUSDCBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useUSDCAllowance(owner: `0x${string}` | undefined, spender: `0x${string}` | undefined) {
  return useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: MOCK_USDC_ABI,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !!owner && !!spender },
  });
}

export function useUSDCApprove() {
  return useWriteContract();
}
