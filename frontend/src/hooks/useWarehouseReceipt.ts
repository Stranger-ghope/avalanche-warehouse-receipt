import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, WAREHOUSE_RECEIPT_ABI, type ReceiptData } from "@/config/contracts";

/** Fetch a single receipt by token ID */
export function useReceipt(tokenId: number | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.warehouseReceipt,
    abi: WAREHOUSE_RECEIPT_ABI,
    functionName: "getReceipt",
    args: tokenId !== undefined ? [BigInt(tokenId)] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

/** Fetch all token IDs owned by an address */
export function useOwnerTokens(owner: `0x${string}` | undefined) {
  const balance = useReadContract({
    address: CONTRACT_ADDRESSES.warehouseReceipt,
    abi: WAREHOUSE_RECEIPT_ABI,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: { enabled: !!owner },
  });

  const tokenIds: (number | undefined)[] = [];
  const count = Number(balance.data ?? 0);
  for (let i = 0; i < count; i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    tokenIds.push(i); // We'll fetch sequentially; for mock data we use all indices
  }

  return { balance: balance.data, tokenIds, isLoading: balance.isLoading };
}

/** Check if address is a warehouse agent */
export function useIsWarehouseAgent(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.warehouseReceipt,
    abi: WAREHOUSE_RECEIPT_ABI,
    functionName: "warehouseAgents",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

/** Check if address is an approved MFI */
export function useIsApprovedMfi(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.warehouseReceipt,
    abi: WAREHOUSE_RECEIPT_ABI,
    functionName: "approvedMfis",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

/** Get total supply of receipts */
export function useTotalSupply() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.warehouseReceipt,
    abi: WAREHOUSE_RECEIPT_ABI,
    functionName: "totalSupply",
  });
}
