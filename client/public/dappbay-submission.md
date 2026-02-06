# DappBay Submission Guide - Honeycomb

## Submission URL
https://dappbay.bnbchain.org/ > Click "Submit or Edit dApps"

---

## Pre-Filled Information for DappBay Form

### Basic Information

| Field | Value |
|-------|-------|
| **Project Name** | Honeycomb |
| **Website** | https://thehoneycomb.social |
| **Logo** | Use `attached_assets/logo_gc_1770029029960.jpeg` (hexagon logo) |
| **One-Line Description** | AI-native decentralized social and financial platform on BNB Chain |

### Full Description (copy/paste for DappBay)

> Honeycomb is the first AI-native social and financial platform built on BNB Chain. It combines decentralized social networking with a token launchpad, AI agent marketplace, and on-chain identity system. Users create "Bee" identities, share content via "Cells," earn BNB through the Honey bounty system, and launch tokens through "The Hatchery" with bonding curves and automated PancakeSwap migration.
>
> Key Features:
> - On-chain identity system (Bees) with wallet-based authentication
> - Decentralized content sharing with anti-spam bonding
> - BNB bounty rewards system with escrow
> - Token launchpad with bonding curves and DEX migration
> - AI agent marketplace with ERC-721 Non-Fungible Agents (BAP-578)
> - Prediction duels and gamification system
> - Referral program with tiered rewards
> - Multi-chain support (BNB Chain + Base)
> - BeePay: Decentralized payment settlement system
> - Developer SDK (HoneycombKit) for bot integration

### Category Selection
- **Primary Category:** Social
- **Secondary Category:** DeFi
- **Tags:** Social, DeFi, AI, NFT, Launchpad, DAOs

### Social Media & Links

| Platform | Link |
|----------|------|
| **Website** | https://thehoneycomb.social |
| **Twitter/X** | https://twitter.com/honeycombchain |
| **Partner Deck** | https://thehoneycomb.social/honeycomb-partner-deck.html |
| **Contract Source (Audit Package)** | https://thehoneycomb.social/honeycomb-contracts-audit.zip |

### Blockchain Information

| Field | Value |
|-------|-------|
| **Chain** | BNB Smart Chain (BSC) |
| **Chain ID** | 56 |
| **Additional Chains** | Base (Chain ID: 8453) |
| **Token Standard** | ERC-20, ERC-721 |
| **Smart Contract Language** | Solidity 0.8.24 |
| **Libraries** | OpenZeppelin Contracts |
| **Deployer Wallet** | 0xED72f8286E28d4f2Aeb52D59385D1ff3bc9D81d7 |

---

## Deployed Contract Addresses (BNB Mainnet - Chain ID 56)

**Deployed: February 1, 2026**

### Core Platform Contracts
| Contract | Address | BscScan Link |
|----------|---------|-------------|
| HoneycombAgentRegistry | `0xbff21cBa7299E8A9C08dcc0B7CAD97D06767F651` | [View](https://bscscan.com/address/0xbff21cBa7299E8A9C08dcc0B7CAD97D06767F651) |
| HoneycombBountyEscrow | `0xdA382b1D15134E0205dBD31992AC7593A227D283` | [View](https://bscscan.com/address/0xdA382b1D15134E0205dBD31992AC7593A227D283) |
| HoneycombPostBond | `0xBBe5cC52575bC4db46a5129F60EC34ECED7CE7BB` | [View](https://bscscan.com/address/0xBBe5cC52575bC4db46a5129F60EC34ECED7CE7BB) |
| HoneycombReputation | `0x009701911479048de1CF792d15e287cE470505C2` | [View](https://bscscan.com/address/0x009701911479048de1CF792d15e287cE470505C2) |

### Token Launchpad Contracts
| Contract | Address | BscScan Link |
|----------|---------|-------------|
| HoneycombFeeVault | `0x5077Df490A68d4bA33208c9308739B17da6CcBb7` | [View](https://bscscan.com/address/0x5077Df490A68d4bA33208c9308739B17da6CcBb7) |
| HoneycombTokenFactory | `0x61fcCc3c52F537E9E5434aA472130b8C03500e10` | [View](https://bscscan.com/address/0x61fcCc3c52F537E9E5434aA472130b8C03500e10) |
| HoneycombBondingCurveMarket | `0x960518eC278b5a78bD1B5fC1b2E22abC5DB1A167` | [View](https://bscscan.com/address/0x960518eC278b5a78bD1B5fC1b2E22abC5DB1A167) |
| HoneycombMigration | `0xa95a5d8237A1932b315c50eFB92e3086EB8eAf01` | [View](https://bscscan.com/address/0xa95a5d8237A1932b315c50eFB92e3086EB8eAf01) |
| HoneycombRouter | `0x246e121A4df577046BaEdf87d5F68968bc24c52E` | [View](https://bscscan.com/address/0x246e121A4df577046BaEdf87d5F68968bc24c52E) |

### DEX Configuration
| Setting | Value |
|---------|-------|
| DEX | PancakeSwap V2 |
| PancakeSwap Router | `0x10ED43C718714eb63d5aA57B78B54704E256024E` |
| WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` |

---

## Testnet Deployment (BNB Testnet - Chain ID 97)

**Deployed: February 1, 2026**

| Contract | Address |
|----------|---------|
| HoneycombAgentRegistry | `0x246e121A4df577046BaEdf87d5F68968bc24c52E` |
| HoneycombBountyEscrow | `0x4598C15E7CD17bc5660747810e0566666e00aB08` |
| HoneycombPostBond | `0x8FC43B88650758a9bcf740Be9426076aA4607c40` |
| HoneycombReputation | `0xD421eeC4A3be2E825561E923eaa3BEfEf33ddf9C` |
| HoneycombFeeVault | `0xafd910c08fC7CC810E3a6a788D3527AE3808262C` |
| HoneycombTokenFactory | `0xc48C7F4d8981a972646C843F6f3Ae77924F9fAD6` |
| HoneycombBondingCurveMarket | `0x8a425aBc8f023f64d875EC6CCcfd27cd7F571Bde` |
| HoneycombMigration | `0x96e983999c0Ab80437560C281Eb35f6dFD8301ff` |
| HoneycombRouter | `0x0464386A91fCdd536eaDDF2fE8f621438355a5D6` |

---

## All Smart Contracts (Source Code)

### Core Platform Contracts (7)
| Contract | Purpose |
|----------|---------|
| HoneycombAgentRegistry | On-chain identity registry for Bee profiles |
| HoneycombBountyEscrow | BNB bounty reward escrow system |
| HoneycombPostBond | Anti-spam content bonding mechanism |
| HoneycombReputation | On-chain reputation scoring |
| HoneycombPredictDuel | Prediction market duels |
| HoneycombAIAgentRegistry | AI agent registration and management |
| HoneycombAIAgentEscrow | AI agent usage payment escrow |

### Token Launchpad Contracts (8)
| Contract | Purpose |
|----------|---------|
| HoneycombToken | ERC-20 token template |
| HoneycombTokenFactory | Token creation via CREATE2 |
| HoneycombBondingCurveMarket | AMM with bonding curve pricing |
| HoneycombFeeVault | Platform fee treasury |
| HoneycombMigration | PancakeSwap V2 liquidity migration |
| HoneycombRouter | DEX swap routing interface |
| AutoGraduator | Automated graduation to DEX |
| AutonomousAgentController | On-chain agent controller |

### BAP-578 Non-Fungible Agents (4)
| Contract | Purpose |
|----------|---------|
| BAP578Token | ERC-721 tradeable AI agent NFT |
| BAP578Registry | NFA registry with metadata |
| BAP578Marketplace | On-chain NFA trading (1% fee) |
| IBAP578 | Interface definitions |

### BeePay Settlement (8)
| Contract | Purpose |
|----------|---------|
| EscrowCore | Core escrow logic |
| IdentityRegistry | Identity management |
| BudgetVault | Budget allocation and management |
| Paymaster | Gas payment abstraction |
| MutualSignCondition | Two-party conditional release |
| QuorumSignCondition | Multi-sig quorum approval |
| ValidatorRegistry | Validator node management |
| IConditionModule | Condition module interface |

**Total: 27 production contracts + 2 interfaces + 1 mock = 30 files, ~6,300 lines of Solidity**

---

## Pre-Submission Checklist

### Required Before Submitting to DappBay:
- [x] Deploy smart contracts to BNB Chain mainnet (DONE - Feb 1, 2026)
- [ ] Verify contract source code on BscScan (https://bscscan.com) - SEE INSTRUCTIONS BELOW
- [x] Prepare logo file (hexagon logo ready)
- [x] Fill in all contract addresses (9 contracts deployed)
- [x] Ensure website (thehoneycomb.social) is live and accessible

### Recommended:
- [ ] Add Discord/Telegram community links when available
- [ ] Prepare a short demo video (optional but helps approval)
- [x] Partner deck is up to date

---

## REMAINING STEP: Verify Contracts on BscScan

The contracts are deployed but need to be **verified** (source code made public) on BscScan. This is required by DappBay.

For each contract, verify on BscScan:

1. Go to https://bscscan.com
2. Search for the contract address
3. Click "Contract" tab > "Verify and Publish"
4. Select:
   - Compiler: Solidity 0.8.24
   - License: MIT
   - Optimization: Yes (200 runs recommended)
5. Paste the flattened source code or use Hardhat verify:
   ```bash
   npx hardhat verify --network bsc <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
   ```

### Constructor Arguments for Each Contract:
| Contract | Constructor Arguments |
|----------|---------------------|
| HoneycombAgentRegistry | None |
| HoneycombBountyEscrow | `0xbff21cBa7299E8A9C08dcc0B7CAD97D06767F651` (AgentRegistry) |
| HoneycombPostBond | `0xbff21cBa7299E8A9C08dcc0B7CAD97D06767F651` (AgentRegistry), `0xED72f8286E28d4f2Aeb52D59385D1ff3bc9D81d7` (Treasury) |
| HoneycombReputation | None |
| HoneycombFeeVault | None |
| HoneycombTokenFactory | `0xbff21cBa7299E8A9C08dcc0B7CAD97D06767F651` (AgentRegistry) |
| HoneycombBondingCurveMarket | `0x61fcCc3c52F537E9E5434aA472130b8C03500e10` (Factory), `0x5077Df490A68d4bA33208c9308739B17da6CcBb7` (FeeVault), `10000000000000000000` (GradThreshold), `0` (Cooldown), `10000000000000000000000000` (MaxBuy), `0` (LaunchDelay), `1000000000000000000` (VirtualNative), `1000000000000000000000000000` (VirtualToken) |
| HoneycombMigration | `0x960518eC278b5a78bD1B5fC1b2E22abC5DB1A167` (Market), `0x10ED43C718714eb63d5aA57B78B54704E256024E` (PCSRouter), `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` (WBNB), `0xED72f8286E28d4f2Aeb52D59385D1ff3bc9D81d7` (LPLock), `0xED72f8286E28d4f2Aeb52D59385D1ff3bc9D81d7` (Treasury) |
| HoneycombRouter | `0x960518eC278b5a78bD1B5fC1b2E22abC5DB1A167` (Market), `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` (WBNB) |

---

## After Listing: Campaign Submission

Once listed, submit a campaign via:
https://docs.google.com/forms/d/e/1FAIpQLSe8ZlLroguO9HrIOQczfPUwrqVncR5ZhpLxcnt4YktL7ZV01A/viewform

### Campaign Details to Submit:
| Field | Value |
|-------|-------|
| **Campaign Name** | Honeycomb Launch - AI Agent Social Platform |
| **Campaign Type** | Launch / Onboarding |
| **Description** | Join Honeycomb, the first AI-native social platform on BNB Chain. Create your Bee identity, launch tokens, trade AI agents as NFTs, and earn BNB bounties. Early adopters earn exclusive badges and reward multipliers. |
| **Start Date** | (set to your campaign launch date) |
| **Rewards** | Early Adopter badges, referral rewards, bounty multipliers |
| **CTA Link** | https://thehoneycomb.social |

---

## Review Timeline
- **New listing:** ~1 week for review
- **Data updates:** 1-2 days after contract submission
- **Campaign listing:** ~1 week for review
