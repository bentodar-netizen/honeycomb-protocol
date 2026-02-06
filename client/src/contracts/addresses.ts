// Contract addresses by chain ID
// Update these after deployment

export interface ContractAddresses {
  agentRegistry: `0x${string}`;
  bountyEscrow: `0x${string}`;
  postBond: `0x${string}`;
  reputation: `0x${string}`;
  feeVault: `0x${string}`;
  tokenFactory: `0x${string}`;
  bondingCurveMarket: `0x${string}`;
  migration: `0x${string}`;
  router: `0x${string}`;
  predictDuel: `0x${string}`;
}

// ERC-8004 Trustless Agents contract addresses (external standard)
// https://github.com/erc-8004/erc-8004-contracts
export interface ERC8004Addresses {
  identityRegistry: `0x${string}`;
  reputationRegistry: `0x${string}`;
}

export const ERC8004_ADDRESSES: Record<number, ERC8004Addresses> = {
  // BSC Mainnet
  56: {
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  },
  // BSC Testnet
  97: {
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  },
};

export function getERC8004Addresses(chainId: number): ERC8004Addresses | null {
  return ERC8004_ADDRESSES[chainId] || null;
}

export interface DexConfig {
  router: `0x${string}`;
  wbnb: `0x${string}`;
  lpLockAddress: `0x${string}`;
}

// Placeholder address for undeployed contracts
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
  // Local Hardhat
  31337: {
    agentRegistry: ZERO_ADDRESS,
    bountyEscrow: ZERO_ADDRESS,
    postBond: ZERO_ADDRESS,
    reputation: ZERO_ADDRESS,
    feeVault: ZERO_ADDRESS,
    tokenFactory: ZERO_ADDRESS,
    bondingCurveMarket: ZERO_ADDRESS,
    migration: ZERO_ADDRESS,
    router: ZERO_ADDRESS,
    predictDuel: ZERO_ADDRESS,
  },
  // BSC Testnet - Deployed February 1, 2026 (v2 with router & no cooldown)
  97: {
    agentRegistry: "0x246e121A4df577046BaEdf87d5F68968bc24c52E",
    bountyEscrow: "0x4598C15E7CD17bc5660747810e0566666e00aB08",
    postBond: "0x8FC43B88650758a9bcf740Be9426076aA4607c40",
    reputation: "0xD421eeC4A3be2E825561E923eaa3BEfEf33ddf9C",
    feeVault: "0xafd910c08fC7CC810E3a6a788D3527AE3808262C",
    tokenFactory: "0xc48C7F4d8981a972646C843F6f3Ae77924F9fAD6",
    bondingCurveMarket: "0x8a425aBc8f023f64d875EC6CCcfd27cd7F571Bde",
    migration: "0x96e983999c0Ab80437560C281Eb35f6dFD8301ff",
    router: "0x0464386A91fCdd536eaDDF2fE8f621438355a5D6",
    predictDuel: ZERO_ADDRESS, // TODO: Deploy and update
  },
  // BSC Mainnet - Deployed February 1, 2026
  56: {
    agentRegistry: "0xbff21cBa7299E8A9C08dcc0B7CAD97D06767F651",
    bountyEscrow: "0xdA382b1D15134E0205dBD31992AC7593A227D283",
    postBond: "0xBBe5cC52575bC4db46a5129F60EC34ECED7CE7BB",
    reputation: "0x009701911479048de1CF792d15e287cE470505C2",
    feeVault: "0x5077Df490A68d4bA33208c9308739B17da6CcBb7",
    tokenFactory: "0x61fcCc3c52F537E9E5434aA472130b8C03500e10",
    bondingCurveMarket: "0x960518eC278b5a78bD1B5fC1b2E22abC5DB1A167",
    migration: "0xa95a5d8237A1932b315c50eFB92e3086EB8eAf01",
    router: "0x246e121A4df577046BaEdf87d5F68968bc24c52E",
    predictDuel: "0x8A3698513850b6dEFA68dD59f4D7DC5E8c2e2650", // Deployed February 2, 2026
  },
  // opBNB Testnet
  5611: {
    agentRegistry: ZERO_ADDRESS,
    bountyEscrow: ZERO_ADDRESS,
    postBond: ZERO_ADDRESS,
    reputation: ZERO_ADDRESS,
    feeVault: ZERO_ADDRESS,
    tokenFactory: ZERO_ADDRESS,
    bondingCurveMarket: ZERO_ADDRESS,
    migration: ZERO_ADDRESS,
    router: ZERO_ADDRESS,
    predictDuel: ZERO_ADDRESS,
  },
  // opBNB Mainnet
  204: {
    agentRegistry: ZERO_ADDRESS,
    bountyEscrow: ZERO_ADDRESS,
    postBond: ZERO_ADDRESS,
    reputation: ZERO_ADDRESS,
    feeVault: ZERO_ADDRESS,
    tokenFactory: ZERO_ADDRESS,
    bondingCurveMarket: ZERO_ADDRESS,
    migration: ZERO_ADDRESS,
    router: ZERO_ADDRESS,
    predictDuel: ZERO_ADDRESS,
  },
};

// PancakeSwap V2 addresses by chain ID
export const DEX_CONFIG: Record<number, DexConfig> = {
  // BSC Mainnet
  56: {
    router: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    wbnb: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    lpLockAddress: ZERO_ADDRESS, // Update after LP lock contract deployment
  },
  // BSC Testnet
  97: {
    router: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
    wbnb: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    lpLockAddress: ZERO_ADDRESS,
  },
  // Local Hardhat (no DEX)
  31337: {
    router: ZERO_ADDRESS,
    wbnb: ZERO_ADDRESS,
    lpLockAddress: ZERO_ADDRESS,
  },
  // opBNB Testnet - PancakeSwap not officially supported
  5611: {
    router: ZERO_ADDRESS,
    wbnb: ZERO_ADDRESS,
    lpLockAddress: ZERO_ADDRESS,
  },
  // opBNB Mainnet - PancakeSwap not officially supported
  204: {
    router: ZERO_ADDRESS,
    wbnb: ZERO_ADDRESS,
    lpLockAddress: ZERO_ADDRESS,
  },
};

export function getContractAddresses(chainId: number): ContractAddresses | null {
  return CONTRACT_ADDRESSES[chainId] || null;
}

export function getDexConfig(chainId: number): DexConfig | null {
  return DEX_CONFIG[chainId] || null;
}

// BAP-578 NFA Marketplace addresses
export interface NFAMarketplaceAddresses {
  nfaToken: `0x${string}`;
  marketplace: `0x${string}`;
  feeWallet: `0x${string}`;
}

// Platform fee wallet for 1% marketplace fees
export const NFA_FEE_WALLET = "0xEA42922A5c695bD947246988B7927fbD3fD889fF" as `0x${string}`;

export const NFA_MARKETPLACE_ADDRESSES: Record<number, NFAMarketplaceAddresses> = {
  // BSC Mainnet
  56: {
    nfaToken: "0x0000000000000000000000000000000000000000", // TODO: Deploy BAP-578 token
    marketplace: "0x0000000000000000000000000000000000000000", // TODO: Deploy marketplace
    feeWallet: NFA_FEE_WALLET,
  },
  // BSC Testnet
  97: {
    nfaToken: "0x0000000000000000000000000000000000000000", // TODO: Deploy BAP-578 token
    marketplace: "0x0000000000000000000000000000000000000000", // TODO: Deploy marketplace
    feeWallet: NFA_FEE_WALLET,
  },
  // Local Hardhat
  31337: {
    nfaToken: "0x0000000000000000000000000000000000000000",
    marketplace: "0x0000000000000000000000000000000000000000",
    feeWallet: NFA_FEE_WALLET,
  },
};

export function getNFAMarketplaceAddresses(chainId: number): NFAMarketplaceAddresses | null {
  return NFA_MARKETPLACE_ADDRESSES[chainId] || null;
}
