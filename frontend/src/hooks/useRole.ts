"use client";

import { useAccount } from "wagmi";
import { useIsWarehouseAgent, useIsApprovedMfi } from "./useWarehouseReceipt";

export type Role = "farmer" | "agent" | "mfi" | "unverified" | "loading";

/** Determine the role of the connected wallet address.
 *  An address can be a Farmer (holds tokens), Agent (registered), or MFI (approved).
 *  If none match, returns "unverified".
 */
export function useRole(): { role: Role; isLoading: boolean } {
  const { address, isConnected } = useAccount();
  const { data: isAgent, isLoading: agentLoading } = useIsWarehouseAgent(address);
  const { data: isMfi, isLoading: mfiLoading } = useIsApprovedMfi(address);

  if (!isConnected || !address) return { role: "unverified", isLoading: false };
  if (agentLoading || mfiLoading) return { role: "loading", isLoading: true };

  if (isAgent) return { role: "agent", isLoading: false };
  if (isMfi) return { role: "mfi", isLoading: false };
  return { role: "farmer", isLoading: false };
}
