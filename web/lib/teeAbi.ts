export const TEE_REGISTRY_ABI = [
  "function governance() view returns (address)",
  "function isActiveTee(address tee) view returns (bool)",
  "function identityOf(address tee) view returns (bytes32 codeMeasurement,uint64 registeredAt,uint64 expiresAt,bool revoked)",
  "function isApprovedMeasurement(bytes32 codeMeasurement) view returns (bool)"
] as const;
export const COSTON2 = { chainId: 114, chainName: "Coston2", nativeCurrency: { name: "C2FLR", symbol: "C2FLR", decimals: 18 }, rpcUrls: ["https://coston2-api.flare.network/ext/C/rpc"], blockExplorerUrls: ["https://coston2-explorer.flare.network"] };
