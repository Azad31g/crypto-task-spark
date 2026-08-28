export const AZOX_AIRDROP_ADDRESS =
  "0xb87deb7f924adf99d46830fd61e965da06268300" as `0x${string}`;

export const REGISTRATION_FEE = BigInt("600000000000000"); // 0.0006 ETH in wei

export const AZOX_AIRDROP_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    name: "isEligible",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "totalRegistered",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
