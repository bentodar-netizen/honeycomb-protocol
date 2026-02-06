import { db } from "./db";
import { housebotConfig, housebotDuels, matchmakingQueue, duels } from "@shared/schema";
import { eq, and, lt, gte, desc } from "drizzle-orm";
import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";

const PREDICT_DUEL_ADDRESS = "0x8A3698513850b6dEFA68dD59f4D7DC5E8c2e2650";

const PREDICT_DUEL_ABI = parseAbi([
  "function joinDuel(uint256 duelId, uint256 agentId) external payable",
  "function getDuel(uint256 duelId) external view returns (tuple(uint256 id, address creatorAddress, uint256 creatorAgentId, uint8 creatorDirection, address joinerAddress, uint256 joinerAgentId, uint256 assetId, uint256 startPrice, uint256 endPrice, uint256 stakeAmount, uint256 duration, uint256 startTime, uint256 endTime, uint8 status, address winner, uint256 payout, uint256 fee, uint8 duelType, uint256 vrfRequestId, uint256 vrfRandomWord))",
]);

interface HouseBotStatus {
  enabled: boolean;
  walletAddress: string | null;
  maxStakeWei: string;
  dailyLossLimitWei: string;
  currentDailyLossWei: string;
  maxConcurrentDuels: number;
  activeDuels: number;
  allowedAssets: string[];
  allowedDuelTypes: string[];
  dailyLossRemaining: string;
  canJoinDuels: boolean;
}

export class HouseBotService {
  private static instance: HouseBotService | null = null;
  
  static getInstance(): HouseBotService {
    if (!HouseBotService.instance) {
      HouseBotService.instance = new HouseBotService();
    }
    return HouseBotService.instance;
  }

  async getConfig() {
    const configs = await db.select().from(housebotConfig).limit(1);
    if (configs.length === 0) {
      const [newConfig] = await db.insert(housebotConfig).values({
        enabled: false,
      }).returning();
      return newConfig;
    }
    
    const config = configs[0];
    
    // Auto-populate wallet address from private key if not set
    if (!config.walletAddress && process.env.HOUSEBOT_PRIVATE_KEY) {
      const derivedAddress = this.getWalletAddressFromKey();
      if (derivedAddress) {
        const [updated] = await db.update(housebotConfig)
          .set({ walletAddress: derivedAddress.toLowerCase(), updatedAt: new Date() })
          .where(eq(housebotConfig.id, config.id))
          .returning();
        return updated;
      }
    }
    
    return config;
  }

  async updateConfig(updates: Partial<{
    enabled: boolean;
    walletAddress: string;
    agentId: string;
    onChainAgentId: bigint;
    maxStakeWei: string;
    dailyLossLimitWei: string;
    maxConcurrentDuels: number;
    allowedAssets: string[];
    allowedDuelTypes: string[];
  }>) {
    const config = await this.getConfig();
    const [updated] = await db.update(housebotConfig)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(housebotConfig.id, config.id))
      .returning();
    return updated;
  }

  async getStatus(): Promise<HouseBotStatus> {
    const config = await this.getConfig();
    await this.resetDailyLossIfNeeded(config);
    
    const activeDuelCount = await this.getActiveDuelCount();
    
    const currentLoss = BigInt(config.currentDailyLossWei);
    const dailyLimit = BigInt(config.dailyLossLimitWei);
    const lossRemaining = dailyLimit > currentLoss ? dailyLimit - currentLoss : BigInt(0);
    
    const canJoin = config.enabled && 
      activeDuelCount < config.maxConcurrentDuels && 
      currentLoss < dailyLimit;

    return {
      enabled: config.enabled,
      walletAddress: config.walletAddress,
      maxStakeWei: config.maxStakeWei,
      dailyLossLimitWei: config.dailyLossLimitWei,
      currentDailyLossWei: config.currentDailyLossWei,
      maxConcurrentDuels: config.maxConcurrentDuels,
      activeDuels: activeDuelCount,
      allowedAssets: config.allowedAssets || [],
      allowedDuelTypes: config.allowedDuelTypes || [],
      dailyLossRemaining: lossRemaining.toString(),
      canJoinDuels: canJoin,
    };
  }

  private async resetDailyLossIfNeeded(config: typeof housebotConfig.$inferSelect) {
    const now = new Date();
    const lastReset = new Date(config.lastDailyReset);
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceReset >= 24) {
      await db.update(housebotConfig)
        .set({
          currentDailyLossWei: "0",
          lastDailyReset: now,
          updatedAt: now,
        })
        .where(eq(housebotConfig.id, config.id));
    }
  }

  private async getActiveDuelCount(): Promise<number> {
    const config = await this.getConfig();
    if (!config.walletAddress) return 0;
    
    const activeDuels = await db.select()
      .from(duels)
      .where(
        and(
          eq(duels.joinerAddress, config.walletAddress.toLowerCase()),
          eq(duels.status, "live")
        )
      );
    return activeDuels.length;
  }

  async canJoinDuel(duel: typeof duels.$inferSelect): Promise<{ canJoin: boolean; reason?: string }> {
    const config = await this.getConfig();
    
    if (!config.enabled) {
      return { canJoin: false, reason: "HouseBot is disabled" };
    }
    
    if (!config.walletAddress) {
      return { canJoin: false, reason: "HouseBot wallet not configured" };
    }

    if (duel.creatorAddress.toLowerCase() === config.walletAddress.toLowerCase()) {
      return { canJoin: false, reason: "Cannot join own duel" };
    }

    const stakeWei = BigInt(duel.stakeWei);
    const maxStake = BigInt(config.maxStakeWei);
    if (stakeWei > maxStake) {
      return { canJoin: false, reason: `Stake ${duel.stakeDisplay} exceeds max ${Number(maxStake) / 1e18} BNB` };
    }

    const currentLoss = BigInt(config.currentDailyLossWei);
    const dailyLimit = BigInt(config.dailyLossLimitWei);
    if (currentLoss >= dailyLimit) {
      return { canJoin: false, reason: "Daily loss limit reached" };
    }

    const activeDuels = await this.getActiveDuelCount();
    if (activeDuels >= config.maxConcurrentDuels) {
      return { canJoin: false, reason: `Max concurrent duels (${config.maxConcurrentDuels}) reached` };
    }

    if (!config.allowedAssets?.includes(duel.assetId)) {
      return { canJoin: false, reason: `Asset ${duel.assetId} not in allowed list` };
    }

    const duelType = duel.duelType || "price";
    if (!config.allowedDuelTypes?.includes(duelType)) {
      return { canJoin: false, reason: `Duel type ${duelType} not allowed` };
    }

    return { canJoin: true };
  }

  async logDuelAction(duelId: string, action: "joined" | "won" | "lost" | "draw", pnlWei: string) {
    await db.insert(housebotDuels).values({
      duelId,
      action,
      pnlWei,
    });

    if (action === "lost") {
      const config = await this.getConfig();
      const currentLoss = BigInt(config.currentDailyLossWei);
      const newLoss = currentLoss + BigInt(pnlWei.replace("-", ""));
      
      await db.update(housebotConfig)
        .set({
          currentDailyLossWei: newLoss.toString(),
          updatedAt: new Date(),
        })
        .where(eq(housebotConfig.id, config.id));
    }
  }

  async getRecentActivity(limit: number = 20) {
    return db.select()
      .from(housebotDuels)
      .orderBy(desc(housebotDuels.createdAt))
      .limit(limit);
  }

  async addToMatchmakingQueue(duelId: string, assetId: string, duelType: string, durationSec: number, stakeWei: string, creatorAddress: string) {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    
    await db.insert(matchmakingQueue).values({
      duelId,
      assetId,
      duelType,
      durationSec,
      stakeWei,
      creatorAddress,
      status: "waiting",
      expiresAt,
    });
  }

  async getMatchmakingQueue() {
    return db.select()
      .from(matchmakingQueue)
      .where(
        and(
          eq(matchmakingQueue.status, "waiting"),
          gte(matchmakingQueue.expiresAt, new Date())
        )
      )
      .orderBy(matchmakingQueue.createdAt);
  }

  async expireOldQueueEntries() {
    const now = new Date();
    await db.update(matchmakingQueue)
      .set({ status: "expired" })
      .where(
        and(
          eq(matchmakingQueue.status, "waiting"),
          lt(matchmakingQueue.expiresAt, now)
        )
      );
  }

  async findMatch(stakeWei: string, duelType: string): Promise<typeof matchmakingQueue.$inferSelect | null> {
    const queue = await db.select()
      .from(matchmakingQueue)
      .where(
        and(
          eq(matchmakingQueue.status, "waiting"),
          eq(matchmakingQueue.stakeWei, stakeWei),
          eq(matchmakingQueue.duelType, duelType),
          gte(matchmakingQueue.expiresAt, new Date())
        )
      )
      .limit(1);
    
    return queue[0] || null;
  }

  async markMatched(queueEntryId: string) {
    await db.update(matchmakingQueue)
      .set({ status: "matched" })
      .where(eq(matchmakingQueue.id, queueEntryId));
  }

  /**
   * Join a duel on-chain using the HouseBot wallet
   */
  async joinDuelOnChain(onChainDuelId: string, stakeWei: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const privateKey = process.env.HOUSEBOT_PRIVATE_KEY;
    if (!privateKey) {
      return { success: false, error: "HOUSEBOT_PRIVATE_KEY not configured" };
    }

    const config = await this.getConfig();
    if (!config.onChainAgentId) {
      return { success: false, error: "HouseBot on-chain agent ID not configured" };
    }

    try {
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      
      const publicClient = createPublicClient({
        chain: bsc,
        transport: http("https://bsc-dataseed1.binance.org"),
      });

      const walletClient = createWalletClient({
        account,
        chain: bsc,
        transport: http("https://bsc-dataseed1.binance.org"),
      });

      // Check wallet balance
      const balance = await publicClient.getBalance({ address: account.address });
      const stakeAmount = BigInt(stakeWei);
      
      // Need stake + gas (estimate 0.005 BNB for gas)
      const gasBuffer = BigInt("5000000000000000"); // 0.005 BNB
      if (balance < stakeAmount + gasBuffer) {
        return { 
          success: false, 
          error: `Insufficient balance. Have: ${Number(balance) / 1e18} BNB, Need: ${Number(stakeAmount + gasBuffer) / 1e18} BNB` 
        };
      }

      // Execute joinDuel transaction
      const txHash = await walletClient.writeContract({
        address: PREDICT_DUEL_ADDRESS as `0x${string}`,
        abi: PREDICT_DUEL_ABI,
        functionName: "joinDuel",
        args: [BigInt(onChainDuelId), BigInt(config.onChainAgentId)],
        value: stakeAmount,
      });

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash,
        confirmations: 1,
      });

      if (receipt.status === "success") {
        console.log(`[HouseBot] Successfully joined duel ${onChainDuelId}, tx: ${txHash}`);
        return { success: true, txHash };
      } else {
        return { success: false, error: "Transaction reverted" };
      }
    } catch (error: any) {
      console.error("[HouseBot] Join duel error:", error);
      return { success: false, error: error.message || "Unknown error" };
    }
  }

  /**
   * Get HouseBot wallet balance
   */
  async getWalletBalance(): Promise<{ balance: string; balanceDisplay: string } | null> {
    const privateKey = process.env.HOUSEBOT_PRIVATE_KEY;
    if (!privateKey) return null;

    try {
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      const publicClient = createPublicClient({
        chain: bsc,
        transport: http("https://bsc-dataseed1.binance.org"),
      });

      const balance = await publicClient.getBalance({ address: account.address });
      return {
        balance: balance.toString(),
        balanceDisplay: `${(Number(balance) / 1e18).toFixed(4)} BNB`,
      };
    } catch (error) {
      console.error("[HouseBot] Get balance error:", error);
      return null;
    }
  }

  /**
   * Get HouseBot wallet address from private key
   */
  getWalletAddressFromKey(): string | null {
    const privateKey = process.env.HOUSEBOT_PRIVATE_KEY;
    if (!privateKey) return null;

    try {
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      return account.address;
    } catch {
      return null;
    }
  }
}

export const houseBotService = HouseBotService.getInstance();
