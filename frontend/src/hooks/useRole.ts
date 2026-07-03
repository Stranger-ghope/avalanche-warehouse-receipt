"use client";

import { useAccount } from "wagmi";
import { useIsWarehouseAgent } from "./useWarehouseReceipt";
import { useIsAuthorizedMfi } from "./useLoanOrigination";

export type Role = "farmer" | "agent" | "mfi" | "unverified" | "loading";

/** Determine the role of the connected wallet address.
 *  Agent = registered in WarehouseReceipt.warehouseAgents
 *  MFI = authorized in LoanOrigination.authorizedMfis
 *  Farmer = connected but not agent or mfi
 */
export function useRole(): { role: Role; isLoading: boolean } {
  const { address, isConnected } = useAccount();
  const { data: isAgent, isLoading: agentLoading } = useIsWarehouseAgent(address);
  const { data: isMfi, isLoading: mfiLoading } = useIsAuthorizedMfi(address);

  if (!isConnected || !address) return { role: "unverified", isLoading: false };
  if (agentLoading || mfiLoading) return { role: "loading", isLoading: true };

  if (isAgent) return { role: "agent", isLoading: false };
  if (isMfi) return { role: "mfi", isLoading: false };
  return { role: "farmer", isLoading: false };
}
