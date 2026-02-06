# GMGN Listing Request - Honeycomb (The Hatchery)

## Project Overview

**Project Name:** Honeycomb - The Hatchery  
**Website:** https://thehoneycomb.social  
**Chain:** BNB Smart Chain (Chain ID: 56)  
**Category:** Token Launchpad with Bonding Curve AMM

The Hatchery is a token launchpad on BNB Chain where tokens are instantly tradeable via a bonding curve AMM. Tokens graduate to PancakeSwap V2 when they reach $50k market cap.

---

## Contract Addresses (BSC Mainnet - Chain ID 56)

| Contract | Address |
|----------|---------|
| **Bonding Curve Market** | `0x960518eC278b5a78bD1B5fC1b2E22abC5DB1A167` |
| **Token Factory** | `0x61fcCc3c52F537E9E5434aA472130b8C03500e10` |
| **Fee Vault** | `0x5077Df490A68d4bA33208c9308739B17da6CcBb7` |
| **Migration** | `0xa95a5d8237A1932b315c50eFB92e3086EB8eAf01` |
| **Router** | `0x246e121A4df577046BaEdf87d5F68968bc24c52E` |

---

## Trading Functions

### Buy Tokens
```solidity
function buyTokens(address token) external payable
```
- **token**: The token contract address to buy
- **msg.value**: Amount of BNB to spend
- Emits: `TokensBought(address indexed token, address indexed buyer, uint256 nativeIn, uint256 tokensOut)`

### Sell Tokens
```solidity
function sellTokens(address token, uint256 tokenAmount) external
```
- **token**: The token contract address to sell
- **tokenAmount**: Amount of tokens to sell
- Requires: Token approval to Bonding Curve Market contract
- Emits: `TokensSold(address indexed token, address indexed seller, uint256 tokensIn, uint256 nativeOut)`

---

## Price Query Functions

### Get Current Price
```solidity
function getPrice(address token) external view returns (uint256 price)
```
- Returns: Current token price in BNB (18 decimals)

### Get Buy Quote
```solidity
function getBuyQuote(address token, uint256 nativeAmount) external view returns (uint256 tokensOut)
```
- Returns: Expected tokens received for a given BNB amount

### Get Sell Quote
```solidity
function getSellQuote(address token, uint256 tokenAmount) external view returns (uint256 nativeOut)
```
- Returns: Expected BNB received for a given token amount

### Get Market State
```solidity
function getMarketState(address token) external view returns (
    uint256 reserveNative,
    uint256 reserveToken,
    uint256 totalRaised,
    bool graduated,
    bool migrated
)
```

---

## Events for Indexing

### TokensBought
```solidity
event TokensBought(
    address indexed token,
    address indexed buyer,
    uint256 nativeIn,
    uint256 tokensOut
)
```

### TokensSold
```solidity
event TokensSold(
    address indexed token,
    address indexed seller,
    uint256 tokensIn,
    uint256 nativeOut
)
```

### TokenCreated (from Factory)
```solidity
event TokenCreated(
    address indexed token,
    address indexed creator,
    string name,
    string symbol,
    string metadataCID
)
```

### TokenGraduated
```solidity
event TokenGraduated(
    address indexed token,
    uint256 totalRaised
)
```

---

## Bonding Curve Details

- **Type:** Constant Product (x * y = k)
- **Virtual Reserves:** 1 BNB / 800M tokens (initial)
- **Trading Fee:** 1% (split between fee vault and creator)
- **Graduation:** When total raised reaches threshold, token graduates to PancakeSwap V2
- **Token Standard:** ERC-20 compatible

---

## Token Discovery

### Get All Tokens
Query the Token Factory for `TokenCreated` events to discover all launched tokens.

### Get Active Markets
For each token, query `getMarketState()` to check:
- `graduated = false` means token is still on bonding curve
- `migrated = true` means token has moved to PancakeSwap

---

## API Endpoints

Our backend also provides REST APIs for token data:

| Endpoint | Description |
|----------|-------------|
| `GET /api/launch/tokens` | List all tokens |
| `GET /api/launch/tokens/:address` | Get token details |
| `GET /api/launch/tokens/:address/trades` | Get trade history |
| `GET /api/launch/trending` | Get trending tokens |

---

## Explorer Links

- **Bonding Curve Market:** https://bscscan.com/address/0x960518eC278b5a78bD1B5fC1b2E22abC5DB1A167
- **Token Factory:** https://bscscan.com/address/0x61fcCc3c52F537E9E5434aA472130b8C03500e10

---

## Contact

- **Website:** https://thehoneycomb.social
- **Twitter:** @honeycombchain

---

## Notes for Integration

1. All tokens launched through The Hatchery have addresses ending in "bee" (vanity addresses)
2. Tokens are ERC-20 compatible and can be traded immediately after creation
3. No liquidity lock required during bonding curve phase - liquidity is locked in the contract
4. After graduation, liquidity migrates to PancakeSwap V2 with LP tokens burned/locked
