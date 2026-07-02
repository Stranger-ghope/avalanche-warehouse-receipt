import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, CROP_REGISTRY_ABI } from "@/config/contracts";

/** Fetch crop definition by keccak256 crop type */
export function useCropDefinition(cropType: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.cropRegistry,
    abi: CROP_REGISTRY_ABI,
    functionName: "getCropDefinition",
    args: cropType ? [cropType] : undefined,
    query: { enabled: !!cropType },
  });
}

/** Check if a crop type is active in the registry */
export function useIsCropActive(cropType: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.cropRegistry,
    abi: CROP_REGISTRY_ABI,
    functionName: "isCropActive",
    args: cropType ? [cropType] : undefined,
    query: { enabled: !!cropType },
  });
}
