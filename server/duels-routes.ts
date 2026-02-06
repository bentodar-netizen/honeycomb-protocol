import type { Express } from "express";
import { storage } from "./storage";
import { authMiddleware } from "./auth";
import { createDuelRequestSchema, joinDuelRequestSchema } from "@shared/schema";
import { z } from "zod";

// Zod schema for HouseBot config updates
const housebotConfigUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  walletAddress: z.string().optional(),
  agentId: z.string().optional(),
  onChainAgentId: z.string().optional(),
  maxStakeWei: z.string().optional(),
  dailyLossLimitWei: z.string().optional(),
  maxConcurrentDuels: z.number().int().min(1).max(20).optional(),
  allowedAssets: z.array(z.string()).optional(),
  allowedDuelTypes: z.array(z.enum(["price", "random"])).optional(),
}).strict();
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";

const FEE_TREASURY_ADDRESS = "0xEA42922A5c695bD947246988B7927fbD3fD889fF";
const PREDICT_DUEL_ADDRESS = "0x8A3698513850b6dEFA68dD59f4D7DC5E8c2e2650" as `0x${string}`;

const SETTLE_DUEL_ABI = [{
  type: "function",
  name: "settleDuel",
  inputs: [
    { name: "duelId", type: "uint256" },
    { name: "endPrice", type: "uint256" }
  ],
  outputs: [],
  stateMutability: "nonpayable",
}] as const;

// Mutex lock to prevent concurrent settlement of the same duel
const settlingLocks = new Set<string>();

const FEE_PERCENTAGE = 10;
const DUEL_EXPIRY_MINUTES = 5; // Auto-cancel open duels after 5 minutes

// Price cache to avoid CoinGecko rate limits (free tier: 10-30 req/min)
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL_MS = 10000; // 10 seconds cache

// CoinGecko ID mapping for price data (Binance is geo-blocked from server)
const COINGECKO_IDS: Record<string, string> = {
  "BNB": "binancecoin",
  "BTC": "bitcoin",
  "ETH": "ethereum",
  "SOL": "solana",
  "DOGE": "dogecoin",
  "PEPE": "pepe",
  "SHIB": "shiba-inu",
  "XRP": "ripple",
  "ADA": "cardano",
  "AVAX": "avalanche-2",
  "MATIC": "matic-network",
  "LINK": "chainlink",
};

// Kraken symbol mapping (works from US servers, matches TradingView prices)
const KRAKEN_SYMBOLS: Record<string, string> = {
  "BNB": "BNBUSD",
  "BTC": "XBTUSD",
  "ETH": "ETHUSD",
  "SOL": "SOLUSD",
  "DOGE": "DOGEUSD",
  "XRP": "XRPUSD",
  "ADA": "ADAUSD",
  "AVAX": "AVAXUSD",
  "MATIC": "MATICUSD",
  "LINK": "LINKUSD",
};

// Binance symbol mapping (for reference, but API is geo-blocked)
const BINANCE_SYMBOLS: Record<string, string> = {
  "BNB": "BNBUSDT",
  "BTC": "BTCUSDT",
  "ETH": "ETHUSDT",
  "SOL": "SOLUSDT",
  "DOGE": "DOGEUSDT",
  "PEPE": "PEPEUSDT",
  "SHIB": "SHIBUSDT",
  "XRP": "XRPUSDT",
  "ADA": "ADAUSDT",
  "AVAX": "AVAXUSDT",
  "MATIC": "MATICUSDT",
  "LINK": "LINKUSDT",
};

// Helper to convert BigInt fields to strings for JSON serialization
function serializeDuel(duel: any) {
  if (!duel) return duel;
  return {
    ...duel,
    onChainDuelId: duel.onChainDuelId?.toString() || null,
    creatorOnChainAgentId: duel.creatorOnChainAgentId?.toString() || null,
    joinerOnChainAgentId: duel.joinerOnChainAgentId?.toString() || null,
  };
}

// Background job to auto-cancel expired open duels
function startDuelExpiryChecker() {
  setInterval(async () => {
    try {
      const cancelledCount = await storage.autoCancelExpiredDuels(DUEL_EXPIRY_MINUTES);
      if (cancelledCount > 0) {
        console.log(`Auto-cancelled ${cancelledCount} expired duel(s) after ${DUEL_EXPIRY_MINUTES} minutes`);
      }
    } catch (error) {
      console.error("Error in duel expiry checker:", error);
    }
  }, 60000); // Check every minute
}

export function registerDuelsRoutes(app: Express) {
  // Start the background job for auto-cancelling expired duels
  startDuelExpiryChecker();
  
  app.get("/api/duels/assets", async (_req, res) => {
    try {
      await storage.seedDuelAssets();
      const assets = await storage.getDuelAssets();
      res.json(assets);
    } catch (error) {
      console.error("Error fetching duel assets:", error);
      res.status(500).json({ message: "Failed to fetch assets" });
    }
  });

  app.get("/api/duels", async (req, res) => {
    try {
      const status = (req.query.status as string) || "all";
      const limit = parseInt(req.query.limit as string) || 50;
      
      const validStatuses = ["open", "live", "settled", "cancelled", "all"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const duels = await storage.getDuels(status as "open" | "live" | "settled" | "cancelled" | "all", limit);
      res.json(duels.map(serializeDuel));
    } catch (error) {
      console.error("Error fetching duels:", error);
      res.status(500).json({ message: "Failed to fetch duels" });
    }
  });

  app.get("/api/duels/:id", async (req, res) => {
    try {
      const duel = await storage.getDuel(req.params.id);
      if (!duel) {
        return res.status(404).json({ message: "Duel not found" });
      }
      res.json(serializeDuel(duel));
    } catch (error) {
      console.error("Error fetching duel:", error);
      res.status(500).json({ message: "Failed to fetch duel" });
    }
  });

  // Direct duel creation disabled - must use on-chain flow via /api/duels/sync-create
  // This endpoint now returns an error instructing users to use on-chain transactions
  app.post("/api/duels", authMiddleware, async (req, res) => {
    return res.status(400).json({ 
      message: "Direct duel creation is disabled. Please use on-chain transactions on BSC Mainnet.",
      code: "ON_CHAIN_REQUIRED"
    });
  });

  // Direct duel joining disabled - must use on-chain flow via /api/duels/:id/sync-join
  // This endpoint now returns an error instructing users to use on-chain transactions
  app.post("/api/duels/:id/join", authMiddleware, async (req, res) => {
    return res.status(400).json({ 
      message: "Direct duel joining is disabled. Please use on-chain transactions on BSC Mainnet.",
      code: "ON_CHAIN_REQUIRED"
    });
  });

  app.post("/api/duels/:id/cancel", authMiddleware, async (req, res) => {
    try {
      const walletAddress = req.walletAddress!;
      const duelId = req.params.id as string;

      const duel = await storage.getDuel(duelId);
      if (!duel) {
        return res.status(404).json({ message: "Duel not found" });
      }

      if (duel.creatorAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ message: "Only the creator can cancel" });
      }

      if (duel.status !== "open") {
        return res.status(400).json({ message: "Can only cancel open duels" });
      }

      const updatedDuel = await storage.updateDuel(duelId, { status: "cancelled" });
      res.json(serializeDuel(updatedDuel));
    } catch (error) {
      console.error("Error cancelling duel:", error);
      res.status(500).json({ message: "Failed to cancel duel" });
    }
  });

  app.post("/api/duels/:id/settle", async (req, res) => {
    try {
      const duelId = req.params.id as string;

      const duel = await storage.getDuel(duelId);
      if (!duel) {
        return res.status(404).json({ message: "Duel not found" });
      }

      if (duel.status !== "live") {
        return res.status(400).json({ message: "Duel is not live" });
      }

      if (!duel.endTs || new Date() < duel.endTs) {
        return res.status(400).json({ message: "Duel has not ended yet" });
      }

      const endPrice = await fetchPrice(duel.assetId);
      const startPrice = BigInt(duel.startPrice || "0");
      const endPriceBigInt = BigInt(endPrice);

      let winnerAddress: string | null = null;
      const pot = BigInt(duel.stakeWei) * BigInt(2);
      const fee = (pot * BigInt(FEE_PERCENTAGE)) / BigInt(100);
      const payout = pot - fee;
      
      console.log(`Duel ${duelId} settled: Fee ${fee.toString()} wei → ${FEE_TREASURY_ADDRESS}`);

      if (endPriceBigInt > startPrice) {
        winnerAddress = duel.creatorDirection === "up" ? duel.creatorAddress : duel.joinerAddress;
      } else if (endPriceBigInt < startPrice) {
        winnerAddress = duel.creatorDirection === "down" ? duel.creatorAddress : duel.joinerAddress;
      }

      const settledDuel = await storage.settleDuel(
        duelId,
        endPrice,
        winnerAddress,
        payout.toString(),
        fee.toString()
      );

      res.json(serializeDuel(settledDuel));
    } catch (error) {
      console.error("Error settling duel:", error);
      res.status(500).json({ message: "Failed to settle duel" });
    }
  });

  app.get("/api/duels/price/:assetId", async (req, res) => {
    try {
      const assetId = req.params.assetId;
      if (!Object.hasOwn(COINGECKO_IDS, assetId)) {
        return res.status(400).json({ message: `Unsupported asset: ${assetId}` });
      }
      
      const price = await fetchPrice(assetId);
      res.json({ 
        assetId, 
        price, 
        priceFormatted: formatPrice(price),
        timestamp: Date.now() 
      });
    } catch (error) {
      console.error("Error fetching price:", error);
      res.status(500).json({ message: "Failed to fetch price" });
    }
  });

  // Price history using CoinGecko (Binance is geo-blocked from server)
  app.get("/api/duels/binance/klines/:assetId", async (req, res) => {
    try {
      const assetId = req.params.assetId;
      if (!Object.hasOwn(COINGECKO_IDS, assetId)) {
        return res.status(400).json({ message: `Unsupported asset: ${assetId}` });
      }
      
      const coinId = COINGECKO_IDS[assetId];
      const symbol = BINANCE_SYMBOLS[assetId] || `${assetId}USDT`;
      
      // CoinGecko market chart - get last 1 day with 5 min intervals
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=1`
      );
      
      if (!response.ok) {
        return res.status(400).json({ message: `Failed to fetch history for ${assetId}` });
      }
      
      const data = await response.json();
      
      if (data.prices && Array.isArray(data.prices)) {
        // CoinGecko returns [timestamp, price] pairs
        // Sample every 5th point to reduce data and simulate OHLC
        const sampled = data.prices.filter((_: any, i: number) => i % 5 === 0);
        const klines = sampled.map((p: [number, number], i: number) => {
          const price = p[1];
          const prevPrice = i > 0 ? sampled[i - 1][1] : price;
          // Simulate OHLC with small variation
          const variation = price * 0.001;
          return {
            timestamp: p[0],
            open: prevPrice,
            high: Math.max(price, prevPrice) + variation,
            low: Math.min(price, prevPrice) - variation,
            close: price,
            volume: 0
          };
        });
        res.json({ symbol, klines: klines.slice(-60) }); // Last 60 points
      } else {
        res.status(400).json({ message: "Failed to fetch price history" });
      }
    } catch (error) {
      console.error("Error fetching price history:", error);
      res.status(500).json({ message: "Failed to fetch price history" });
    }
  });

  // Price ticker using CoinGecko with caching (Binance is geo-blocked from server)
  app.get("/api/duels/binance/ticker/:assetId", async (req, res) => {
    try {
      const assetId = req.params.assetId;
      if (!Object.hasOwn(COINGECKO_IDS, assetId)) {
        return res.status(400).json({ message: `Unsupported asset: ${assetId}` });
      }
      
      const coinId = COINGECKO_IDS[assetId];
      const symbol = BINANCE_SYMBOLS[assetId] || `${assetId}USDT`;
      
      // Check cache first (short TTL for live prices)
      const cached = priceCache.get(assetId);
      const now = Date.now();
      if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
        return res.json({ 
          symbol, 
          price: cached.price,
          priceScaled: Math.floor(cached.price * 1e8).toString(),
          timestamp: cached.timestamp,
          cached: true
        });
      }
      
      let price: number | null = null;
      
      // Try CryptoCompare first (fastest, most reliable)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(
          `https://min-api.cryptocompare.com/data/price?fsym=${assetId}&tsyms=USD`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          if (data?.USD && typeof data.USD === 'number') {
            price = data.USD;
          }
        }
      } catch (e) {
        // CryptoCompare failed, try next source
      }
      
      // Try Kraken as backup
      if (price === null) {
        const krakenSymbol = KRAKEN_SYMBOLS[assetId];
        if (krakenSymbol) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(
              `https://api.kraken.com/0/public/Ticker?pair=${krakenSymbol}`,
              { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const data = await response.json();
              const resultKey = Object.keys(data?.result || {})[0];
              if (resultKey && data.result[resultKey]?.c?.[0]) {
                price = parseFloat(data.result[resultKey].c[0]);
              }
            }
          } catch (e) {
            // Kraken failed, try next source
          }
        }
      }
      
      // Try CoinGecko as last resort
      if (price === null && coinId) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            if (data[coinId]?.usd) {
              price = data[coinId].usd;
            }
          }
        } catch (e) {
          // CoinGecko failed
        }
      }
      
      // If still no price, use cached value even if stale
      if (price === null && cached) {
        return res.json({ 
          symbol, 
          price: cached.price,
          priceScaled: Math.floor(cached.price * 1e8).toString(),
          timestamp: cached.timestamp,
          cached: true,
          stale: true
        });
      }
      
      if (price !== null) {
        // Update cache
        priceCache.set(assetId, { price, timestamp: now });
        
        res.json({ 
          symbol, 
          price,
          priceScaled: Math.floor(price * 1e8).toString(),
          timestamp: now 
        });
      } else {
        res.status(400).json({ message: "Failed to fetch price - please try again" });
      }
    } catch (error) {
      console.error("Error fetching price:", error);
      res.status(500).json({ message: "Failed to fetch price" });
    }
  });

  app.get("/api/duels/config", async (_req, res) => {
    res.json({
      feePercentage: FEE_PERCENTAGE,
      feeTreasury: FEE_TREASURY_ADDRESS,
      payoutPercentage: 100 - FEE_PERCENTAGE
    });
  });

  // Sync on-chain duel creation with database
  app.post("/api/duels/sync-create", authMiddleware, async (req, res) => {
    try {
      const walletAddress = req.walletAddress!;
      const { 
        onChainDuelId, 
        txHash, 
        assetId, 
        assetName, 
        durationSec, 
        stakeWei, 
        stakeDisplay, 
        creatorOnChainAgentId, 
        direction 
      } = req.body;

      if (!onChainDuelId || !txHash) {
        return res.status(400).json({ message: "Missing on-chain duel ID or transaction hash" });
      }

      const agent = await storage.getAgentByAddress(walletAddress);

      const duel = await storage.createDuel({
        onChainDuelId: BigInt(onChainDuelId),
        createTxHash: txHash,
        assetId,
        assetName,
        durationSec: parseInt(durationSec),
        stakeWei,
        stakeDisplay,
        creatorAddress: walletAddress,
        creatorAgentId: agent?.id || null,
        creatorOnChainAgentId: BigInt(creatorOnChainAgentId),
        creatorDirection: direction,
      });

      res.status(201).json(serializeDuel(duel));
    } catch (error) {
      console.error("Error syncing on-chain duel creation:", error);
      res.status(500).json({ message: "Failed to sync on-chain duel" });
    }
  });

  // Sync on-chain duel join with database
  app.post("/api/duels/:id/sync-join", authMiddleware, async (req, res) => {
    try {
      const walletAddress = req.walletAddress!;
      const duelId = req.params.id as string;
      const { txHash, joinerOnChainAgentId, startPrice } = req.body;

      if (!txHash) {
        return res.status(400).json({ message: "Missing transaction hash" });
      }

      const duel = await storage.getDuel(duelId);
      if (!duel) {
        return res.status(404).json({ message: "Duel not found" });
      }

      const agent = await storage.getAgentByAddress(walletAddress);
      const joinerDirection = duel.creatorDirection === "up" ? "down" : "up";
      const now = new Date();
      const endTs = new Date(now.getTime() + duel.durationSec * 1000);

      // Fetch current Binance price for accurate start price
      let finalStartPrice = startPrice;
      if (!startPrice) {
        finalStartPrice = await fetchPrice(duel.assetId);
      }

      const updatedDuel = await storage.updateDuel(duelId, {
        joinerAddress: walletAddress,
        joinerAgentId: agent?.id || null,
        joinerOnChainAgentId: joinerOnChainAgentId ? BigInt(joinerOnChainAgentId) : null,
        joinerDirection,
        startPrice: finalStartPrice,
        startTs: now,
        endTs,
        status: "live",
        joinTxHash: txHash,
      });

      res.json(serializeDuel(updatedDuel));
    } catch (error) {
      console.error("Error syncing on-chain duel join:", error);
      res.status(500).json({ message: "Failed to sync on-chain join" });
    }
  });

  // Sync on-chain settlement with database
  app.post("/api/duels/:id/sync-settle", authMiddleware, async (req, res) => {
    try {
      const duelId = req.params.id as string;
      const { txHash, endPrice, winnerAddress } = req.body;

      if (!txHash) {
        return res.status(400).json({ message: "Missing transaction hash" });
      }

      const duel = await storage.getDuel(duelId);
      if (!duel) {
        return res.status(404).json({ message: "Duel not found" });
      }

      if (duel.status !== "live") {
        return res.status(400).json({ message: "Duel is not live" });
      }

      // Fetch current price for end price if not provided
      let finalEndPrice = endPrice;
      if (!endPrice) {
        finalEndPrice = await fetchPrice(duel.assetId);
      }

      // Calculate winner based on price movement
      const startPriceNum = parseFloat(duel.startPrice || "0");
      const endPriceNum = parseFloat(finalEndPrice);
      const priceWentUp = endPriceNum > startPriceNum;
      
      let calculatedWinner: string | null = null;
      if (startPriceNum === endPriceNum) {
        // Draw - no winner (refund handled by contract)
        calculatedWinner = null;
      } else if (priceWentUp) {
        // Price went up - whoever bet "up" wins
        calculatedWinner = duel.creatorDirection === "up" ? duel.creatorAddress : duel.joinerAddress;
      } else {
        // Price went down - whoever bet "down" wins
        calculatedWinner = duel.creatorDirection === "down" ? duel.creatorAddress : duel.joinerAddress;
      }

      // Calculate payout (90% of total pot)
      const stakeWei = BigInt(duel.stakeWei);
      const totalPot = stakeWei * BigInt(2);
      const feeWei = (totalPot * BigInt(FEE_PERCENTAGE)) / BigInt(100);
      const payoutWei = totalPot - feeWei;

      const updatedDuel = await storage.updateDuel(duelId, {
        endPrice: finalEndPrice,
        status: "settled",
        winnerAddress: winnerAddress || calculatedWinner,
        payoutWei: payoutWei.toString(),
        feeWei: feeWei.toString(),
        settlementTxHash: txHash,
      });

      res.json(serializeDuel(updatedDuel));
    } catch (error) {
      console.error("Error syncing on-chain settlement:", error);
      res.status(500).json({ message: "Failed to sync settlement" });
    }
  });

  // Sync on-chain cancellation with database
  app.post("/api/duels/:id/sync-cancel", authMiddleware, async (req, res) => {
    try {
      const walletAddress = req.walletAddress!;
      const duelId = req.params.id as string;
      const { txHash } = req.body;

      if (!txHash) {
        return res.status(400).json({ message: "Missing transaction hash" });
      }

      const duel = await storage.getDuel(duelId);
      if (!duel) {
        return res.status(404).json({ message: "Duel not found" });
      }

      // Verify duel has on-chain ID (required for on-chain cancellation)
      if (!duel.onChainDuelId) {
        return res.status(400).json({ message: "Duel has no on-chain ID" });
      }

      // Verify caller is the creator
      if (duel.creatorAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ message: "Only the creator can cancel this duel" });
      }

      if (duel.status !== "open") {
        return res.status(400).json({ message: "Only open duels can be cancelled" });
      }

      // Verify no joiner has joined yet
      if (duel.joinerAddress) {
        return res.status(400).json({ message: "Cannot cancel duel that has an opponent" });
      }

      const updatedDuel = await storage.updateDuel(duelId, {
        status: "cancelled",
        settlementTxHash: txHash, // Store cancel tx hash in settlement field
      });

      res.json(serializeDuel(updatedDuel));
    } catch (error) {
      console.error("Error syncing on-chain cancellation:", error);
      res.status(500).json({ message: "Failed to sync cancellation" });
    }
  });

  // Sync stake reclaim for auto-cancelled duels
  app.post("/api/duels/:id/sync-reclaim", authMiddleware, async (req, res) => {
    try {
      const walletAddress = req.walletAddress!;
      const duelId = req.params.id as string;
      const { txHash } = req.body;

      if (!txHash) {
        return res.status(400).json({ message: "Missing transaction hash" });
      }

      const duel = await storage.getDuel(duelId);
      if (!duel) {
        return res.status(404).json({ message: "Duel not found" });
      }

      // Verify duel has on-chain ID
      if (!duel.onChainDuelId) {
        return res.status(400).json({ message: "Duel has no on-chain ID" });
      }

      // Verify caller is the creator
      if (duel.creatorAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ message: "Only the creator can reclaim stake" });
      }

      // Only cancelled duels can have stake reclaimed
      if (duel.status !== "cancelled") {
        return res.status(400).json({ message: "Only cancelled duels can have stake reclaimed" });
      }

      // Don't allow double reclaim
      if (duel.settlementTxHash) {
        return res.status(400).json({ message: "Stake has already been reclaimed" });
      }

      const updatedDuel = await storage.updateDuel(duelId, {
        settlementTxHash: txHash, // Store reclaim tx hash
      });

      res.json(serializeDuel(updatedDuel));
    } catch (error) {
      console.error("Error syncing stake reclaim:", error);
      res.status(500).json({ message: "Failed to sync stake reclaim" });
    }
  });

  // Oracle settlement endpoint - settles duel on-chain using backend oracle role
  // This endpoint is idempotent and protected against concurrent calls
  app.post("/api/duels/:id/oracle-settle", async (req, res) => {
    const duelId = req.params.id as string;
    
    try {
      // Check if this duel is already being settled (mutex lock)
      if (settlingLocks.has(duelId)) {
        return res.status(409).json({ message: "Settlement already in progress" });
      }
      
      const duel = await storage.getDuel(duelId);
      if (!duel) {
        return res.status(404).json({ message: "Duel not found" });
      }

      // If already settled, return success with existing data (idempotent)
      if (duel.status === "settled") {
        return res.json({
          success: true,
          message: "Already settled",
          winner: duel.winnerAddress,
          endPrice: duel.endPrice,
          txHash: duel.settlementTxHash,
          duel: serializeDuel(duel),
        });
      }

      // Verify duel is live
      if (duel.status !== "live") {
        return res.status(400).json({ message: "Duel is not live (status: " + duel.status + ")" });
      }

      // Verify duel has on-chain ID
      if (!duel.onChainDuelId || duel.onChainDuelId <= BigInt(1)) {
        return res.status(400).json({ message: "Invalid on-chain duel ID" });
      }

      // Verify duel has expired
      if (!duel.endTs) {
        return res.status(400).json({ message: "Duel has no end time" });
      }
      const now = Date.now();
      const endTime = new Date(duel.endTs).getTime();
      if (now < endTime) {
        const remainingSec = Math.ceil((endTime - now) / 1000);
        return res.status(400).json({ message: `Duel has not expired yet (${remainingSec}s remaining)` });
      }

      // Acquire lock before proceeding
      settlingLocks.add(duelId);
      console.log(`[Oracle Settlement] Lock acquired for duel ${duelId}`);

      // Get deployer private key
      const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
      if (!privateKey) {
        settlingLocks.delete(duelId);
        console.error("DEPLOYER_PRIVATE_KEY not configured");
        return res.status(500).json({ message: "Oracle not configured" });
      }

      // Fetch end price
      const endPriceStr = await fetchPrice(duel.assetId);
      const endPrice = BigInt(endPriceStr);
      const startPrice = BigInt(duel.startPrice || "0");

      console.log(`[Oracle Settlement] Duel ${duelId} (on-chain: ${duel.onChainDuelId})`);
      console.log(`  Asset: ${duel.assetId}, Start: ${startPrice}, End: ${endPrice}`);

      // Create wallet client with oracle role
      const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey as `0x${string}` : `0x${privateKey}`);
      const walletClient = createWalletClient({
        account,
        chain: bsc,
        transport: http("https://bsc-dataseed1.binance.org"),
      });

      // Call settleDuel on-chain
      const hash = await walletClient.writeContract({
        address: PREDICT_DUEL_ADDRESS,
        abi: SETTLE_DUEL_ABI,
        functionName: "settleDuel",
        args: [duel.onChainDuelId, endPrice],
      });

      console.log(`[Oracle Settlement] Tx submitted: ${hash}`);

      // Wait for confirmation
      const publicClient = createPublicClient({
        chain: bsc,
        transport: http("https://bsc-dataseed1.binance.org"),
      });
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60000 });
      
      if (receipt.status !== "success") {
        console.error(`[Oracle Settlement] Tx failed: ${hash}`);
        return res.status(500).json({ message: "Settlement transaction failed on-chain" });
      }

      console.log(`[Oracle Settlement] Tx confirmed: ${hash}`);

      // Determine winner based on price movement
      let winnerAddress: string | null = null;
      const stakeValue = parseFloat(duel.stakeWei) / 1e18;
      const totalPot = stakeValue * 2;
      const winnings = (totalPot * 0.9).toFixed(6);

      if (endPrice > startPrice) {
        // Price went UP
        winnerAddress = duel.creatorDirection === "up" ? duel.creatorAddress : duel.joinerAddress;
      } else if (endPrice < startPrice) {
        // Price went DOWN
        winnerAddress = duel.creatorDirection === "down" ? duel.creatorAddress : duel.joinerAddress;
      } else {
        // Tie - refund both (no winner)
        winnerAddress = null;
      }

      console.log(`[Oracle Settlement] Winner: ${winnerAddress || 'TIE'}, Winnings: ${winnings} BNB`);

      // Update database
      const updatedDuel = await storage.updateDuel(duelId, {
        status: "settled",
        endPrice: endPriceStr,
        winnerAddress,
        settlementTxHash: hash,
      });

      // Release lock after successful settlement
      settlingLocks.delete(duelId);
      console.log(`[Oracle Settlement] Lock released for duel ${duelId}`);

      res.json({
        success: true,
        txHash: hash,
        winner: winnerAddress,
        endPrice: endPriceStr,
        winnings,
        duel: serializeDuel(updatedDuel),
      });
    } catch (error: any) {
      // Always release lock on error
      settlingLocks.delete(duelId);
      console.error(`[Oracle Settlement] Error for duel ${duelId}, lock released:`, error);
      
      const msg = error.message || "Unknown error";
      
      // Parse common contract errors
      if (msg.includes("DuelNotLive")) {
        return res.status(400).json({ message: "Duel is not live on-chain" });
      }
      if (msg.includes("DuelNotEnded") || msg.includes("TooEarly")) {
        return res.status(400).json({ message: "Duel has not ended yet on-chain" });
      }
      if (msg.includes("execution reverted")) {
        // Already settled on-chain - try to sync state
        try {
          const duel = await storage.getDuel(duelId);
          if (duel && duel.status === "live") {
            // Mark as settled in database even if we don't know the winner
            await storage.updateDuel(duelId, { status: "settled" });
          }
        } catch (syncError) {
          console.error("Failed to sync after on-chain revert:", syncError);
        }
        return res.status(400).json({ message: "Settlement may have already occurred on-chain" });
      }
      
      res.status(500).json({ message: msg.slice(0, 200) });
    }
  });

  // ============ LEADERBOARD ENDPOINTS ============

  // Get leaderboard (daily or weekly)
  app.get("/api/duels/leaderboard", async (req, res) => {
    try {
      const range = (req.query.range as string) || "daily";
      const date = req.query.date as string; // YYYY-MM-DD for daily, week start for weekly
      
      const entries = await storage.getLeaderboard(range as "daily" | "weekly", date);
      
      // Enrich with agent info
      const enrichedEntries = await Promise.all(
        entries.map(async (entry: any, index: number) => {
          const agent = await storage.getAgent(entry.agentId);
          return {
            rank: index + 1,
            agentId: entry.agentId,
            ownerAddress: entry.ownerAddress,
            agentName: agent?.name || "Unknown Bee",
            avatarUrl: agent?.avatarUrl,
            wins: entry.wins,
            losses: entry.losses,
            draws: entry.draws,
            pnlWei: entry.pnlWei,
            volumeWei: entry.volumeWei,
            winRate: entry.wins + entry.losses > 0 
              ? Math.round((entry.wins / (entry.wins + entry.losses)) * 100) 
              : 0,
          };
        })
      );
      
      res.json({ 
        range, 
        date: date || (range === "daily" ? getTodayDateString() : getWeekStartDateString()),
        entries: enrichedEntries 
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Get stats for a specific agent
  app.get("/api/duels/stats/:agentId", async (req, res) => {
    try {
      const { agentId } = req.params;
      
      const stats = await storage.getDuelStats(agentId);
      if (!stats) {
        return res.json({
          agentId,
          wins: 0,
          losses: 0,
          draws: 0,
          volumeWei: "0",
          pnlWei: "0",
          winRate: 0,
          totalDuels: 0,
        });
      }
      
      const totalDuels = stats.wins + stats.losses + stats.draws;
      const winRate = totalDuels > 0 ? Math.round((stats.wins / totalDuels) * 100) : 0;
      
      res.json({
        ...stats,
        winRate,
        totalDuels,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Get stats by wallet address
  app.get("/api/duels/stats/wallet/:address", async (req, res) => {
    try {
      const { address } = req.params;
      
      const stats = await storage.getDuelStatsByAddress(address.toLowerCase());
      if (!stats) {
        return res.json({
          ownerAddress: address,
          wins: 0,
          losses: 0,
          draws: 0,
          volumeWei: "0",
          pnlWei: "0",
          winRate: 0,
          totalDuels: 0,
        });
      }
      
      const totalDuels = stats.wins + stats.losses + stats.draws;
      const winRate = totalDuels > 0 ? Math.round((stats.wins / totalDuels) * 100) : 0;
      
      res.json({
        ...stats,
        winRate,
        totalDuels,
      });
    } catch (error) {
      console.error("Error fetching stats by address:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ============ HOUSEBOT ENDPOINTS ============

  // Get HouseBot status (admin only)
  app.get("/api/housebot/status", authMiddleware, async (req, res) => {
    try {
      const ADMIN_ADDRESS = "0xed72f8286e28d4f2aeb52d59385d1ff3bc9d81d7".toLowerCase();
      const userAddress = (req as any).user?.address?.toLowerCase();
      
      if (userAddress !== ADMIN_ADDRESS) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { houseBotService } = await import("./housebot");
      const status = await houseBotService.getStatus();
      const walletBalance = await houseBotService.getWalletBalance();
      const derivedAddress = houseBotService.getWalletAddressFromKey();
      
      res.json({
        ...status,
        walletBalance: walletBalance?.balanceDisplay || "Not configured",
        walletBalanceWei: walletBalance?.balance || "0",
        privateKeyConfigured: !!process.env.HOUSEBOT_PRIVATE_KEY,
        derivedWalletAddress: derivedAddress,
      });
    } catch (error) {
      console.error("Error fetching HouseBot status:", error);
      res.status(500).json({ message: "Failed to fetch HouseBot status" });
    }
  });

  // HouseBot join duel (admin only - manual trigger)
  app.post("/api/housebot/join/:duelId", authMiddleware, async (req, res) => {
    try {
      const ADMIN_ADDRESS = "0xed72f8286e28d4f2aeb52d59385d1ff3bc9d81d7".toLowerCase();
      const userAddress = (req as any).user?.address?.toLowerCase();
      
      if (userAddress !== ADMIN_ADDRESS) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { duelId } = req.params;
      
      // Get duel from database
      const duel = await storage.getDuel(duelId);
      if (!duel) {
        return res.status(404).json({ message: "Duel not found" });
      }
      
      if (duel.status !== "open") {
        return res.status(400).json({ message: "Duel is not open for joining" });
      }
      
      if (!duel.onChainDuelId) {
        return res.status(400).json({ message: "Duel has no on-chain ID" });
      }

      const { houseBotService } = await import("./housebot");
      
      // Check if HouseBot can join
      const canJoinResult = await houseBotService.canJoinDuel(duel);
      if (!canJoinResult.canJoin) {
        return res.status(400).json({ message: canJoinResult.reason });
      }
      
      // Execute on-chain join
      const result = await houseBotService.joinDuelOnChain(duel.onChainDuelId, duel.stakeWei);
      
      if (result.success) {
        // Log the action
        await houseBotService.logDuelAction(duelId, "joined", "0");
        res.json({ 
          success: true, 
          txHash: result.txHash,
          message: `HouseBot joined duel ${duelId}` 
        });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error("Error joining duel with HouseBot:", error);
      res.status(500).json({ message: "Failed to join duel" });
    }
  });

  // Update HouseBot config (admin only)
  app.patch("/api/housebot/config", authMiddleware, async (req, res) => {
    try {
      const ADMIN_ADDRESS = "0xed72f8286e28d4f2aeb52d59385d1ff3bc9d81d7".toLowerCase();
      const userAddress = (req as any).user?.address?.toLowerCase();
      
      if (userAddress !== ADMIN_ADDRESS) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // Validate request body with Zod schema
      const parseResult = housebotConfigUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid config", 
          errors: parseResult.error.errors 
        });
      }
      
      const { houseBotService } = await import("./housebot");
      const updated = await houseBotService.updateConfig(parseResult.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating HouseBot config:", error);
      res.status(500).json({ message: "Failed to update HouseBot config" });
    }
  });

  // Get HouseBot activity log (admin only)
  app.get("/api/housebot/activity", authMiddleware, async (req, res) => {
    try {
      const ADMIN_ADDRESS = "0xed72f8286e28d4f2aeb52d59385d1ff3bc9d81d7".toLowerCase();
      const userAddress = (req as any).user?.address?.toLowerCase();
      
      if (userAddress !== ADMIN_ADDRESS) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const limit = parseInt(req.query.limit as string) || 20;
      const { houseBotService } = await import("./housebot");
      const activity = await houseBotService.getRecentActivity(limit);
      res.json(activity);
    } catch (error) {
      console.error("Error fetching HouseBot activity:", error);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  // Check if HouseBot can join a duel (admin only)
  app.get("/api/housebot/check/:duelId", authMiddleware, async (req, res) => {
    try {
      const ADMIN_ADDRESS = "0xed72f8286e28d4f2aeb52d59385d1ff3bc9d81d7".toLowerCase();
      const userAddress = (req as any).user?.address?.toLowerCase();
      
      if (userAddress !== ADMIN_ADDRESS) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { duelId } = req.params;
      const duel = await storage.getDuel(duelId);
      if (!duel) {
        return res.status(404).json({ message: "Duel not found" });
      }
      
      const { houseBotService } = await import("./housebot");
      const result = await houseBotService.canJoinDuel(duel);
      res.json(result);
    } catch (error) {
      console.error("Error checking duel:", error);
      res.status(500).json({ message: "Failed to check duel" });
    }
  });

  // Get matchmaking queue
  app.get("/api/matchmaking/queue", async (req, res) => {
    try {
      const { houseBotService } = await import("./housebot");
      await houseBotService.expireOldQueueEntries();
      const queue = await houseBotService.getMatchmakingQueue();
      res.json(queue);
    } catch (error) {
      console.error("Error fetching matchmaking queue:", error);
      res.status(500).json({ message: "Failed to fetch queue" });
    }
  });

  // Add duel to matchmaking queue
  app.post("/api/matchmaking/enqueue", authMiddleware, async (req, res) => {
    try {
      const { duelId } = req.body;
      const duel = await storage.getDuel(duelId);
      if (!duel) {
        return res.status(404).json({ message: "Duel not found" });
      }
      
      if (duel.status !== "open") {
        return res.status(400).json({ message: "Only open duels can be enqueued" });
      }
      
      const { houseBotService } = await import("./housebot");
      await houseBotService.addToMatchmakingQueue(
        duelId,
        duel.assetId,
        duel.duelType || "price",
        duel.durationSec,
        duel.stakeWei,
        duel.creatorAddress
      );
      
      res.json({ success: true, message: "Added to matchmaking queue" });
    } catch (error) {
      console.error("Error adding to queue:", error);
      res.status(500).json({ message: "Failed to enqueue" });
    }
  });
}

// Helper functions for date strings
function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function getWeekStartDateString(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Get Monday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

const basePrices: Record<string, number> = {
  BNB: 650,
  BTC: 105000,
  ETH: 3200,
  SOL: 180,
  DOGE: 0.32,
  XRP: 2.5,
  ADA: 1.05,
  AVAX: 35,
  LINK: 25,
  MATIC: 0.45,
};

async function fetchPrice(assetId: string): Promise<string> {
  // Primary: Use CryptoCompare (fast, reliable, matches TradingView)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`https://min-api.cryptocompare.com/data/price?fsym=${assetId}&tsyms=USD`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      if (data?.USD && typeof data.USD === 'number') {
        const price = data.USD;
        console.log(`[fetchPrice] ${assetId} from CryptoCompare: $${price}`);
        return Math.floor(price * 1e8).toString();
      }
    }
  } catch (error: any) {
    const errMsg = error?.name === 'AbortError' ? 'timeout' : error?.message || 'unknown';
    console.log(`[fetchPrice] CryptoCompare failed for ${assetId} (${errMsg})`);
  }
  
  // Secondary: Use Kraken (major exchange, matches TradingView)
  const krakenSymbol = KRAKEN_SYMBOLS[assetId];
  if (krakenSymbol) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${krakenSymbol}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        // Kraken returns: { result: { BNBUSD: { c: ["773.91000", "0.03800"] } } }
        // c[0] is the last trade price
        const resultKey = Object.keys(data?.result || {})[0];
        if (resultKey && data.result[resultKey]?.c?.[0]) {
          const price = parseFloat(data.result[resultKey].c[0]);
          console.log(`[fetchPrice] ${assetId} from Kraken: $${price}`);
          return Math.floor(price * 1e8).toString();
        }
      }
    } catch (error: any) {
      console.log(`[fetchPrice] Kraken failed for ${assetId}`);
    }
  }
  
  // Tertiary: Use CoinGecko
  const coinId = COINGECKO_IDS[assetId];
  if (coinId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data[coinId]?.usd) {
          const price = data[coinId].usd;
          console.log(`[fetchPrice] ${assetId} from CoinGecko: $${price}`);
          return Math.floor(price * 1e8).toString();
        }
      }
    } catch (error: any) {
      console.log(`[fetchPrice] CoinGecko failed for ${assetId}`);
    }
  }
  
  // Last resort: Fallback to base prices (should rarely happen now)
  const basePrice = basePrices[assetId] || 100;
  console.error(`[fetchPrice] CRITICAL: Using fallback price for ${assetId}: $${basePrice} - all APIs failed!`);
  return Math.floor(basePrice * 1e8).toString();
}

function formatPrice(priceStr: string): string {
  const price = parseFloat(priceStr) / 1e8;
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

// Sync on-chain duel creation with database
export async function syncOnChainDuelCreation(
  onChainDuelId: bigint,
  txHash: string,
  assetId: string,
  assetName: string,
  durationSec: number,
  stakeWei: string,
  stakeDisplay: string,
  creatorAddress: string,
  creatorAgentId: string | null,
  creatorOnChainAgentId: bigint,
  creatorDirection: string,
) {
  return storage.createDuel({
    onChainDuelId,
    createTxHash: txHash,
    assetId,
    assetName,
    durationSec,
    stakeWei,
    stakeDisplay,
    creatorAddress,
    creatorAgentId,
    creatorOnChainAgentId,
    creatorDirection,
  });
}

// Sync on-chain duel join with database
export async function syncOnChainDuelJoin(
  duelDbId: string,
  joinerAddress: string,
  joinerAgentId: string | null,
  joinerOnChainAgentId: bigint,
  startPrice: string,
  txHash: string,
) {
  const duel = await storage.getDuel(duelDbId);
  if (!duel) throw new Error("Duel not found");
  
  const joinerDirection = duel.creatorDirection === "up" ? "down" : "up";
  const now = new Date();
  const endTs = new Date(now.getTime() + duel.durationSec * 1000);
  
  return storage.updateDuel(duelDbId, {
    joinerAddress,
    joinerAgentId,
    joinerOnChainAgentId,
    joinerDirection,
    startPrice,
    startTs: now,
    endTs,
    status: "live",
    joinTxHash: txHash,
  });
}
