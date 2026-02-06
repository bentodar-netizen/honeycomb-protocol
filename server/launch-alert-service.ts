import { db } from "./db";
import { launchAlertConfig, launchAlerts, launchTokens, nfaAgents, launchActivity } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { TwitterApi } from "twitter-api-v2";

interface AlertData {
  alertType: "new_token" | "new_nfa" | "graduation" | "migration";
  referenceId: string;
  referenceName: string;
  referenceSymbol?: string;
  referenceImage?: string;
}

const alertTemplates: Record<string, (data: AlertData) => string> = {
  new_token: (data) => `🚀 NEW TOKEN LAUNCH on Honeycomb!

${data.referenceName} (${data.referenceSymbol || 'TOKEN'}) just launched in The Hatchery!

Trade now: thehoneycomb.social/hatchery/${data.referenceId}

#BNBChain #DeFi #Honeycomb`,

  new_nfa: (data) => `🤖 NEW AI AGENT MINTED!

${data.referenceName} is now live on the NFA Marketplace!

Powered by BAP-578 with on-chain memory and learning capabilities.

Explore: thehoneycomb.social/nfa/${data.referenceId}

#AIAgents #BNBChain #Web3`,

  graduation: (data) => `🎓 TOKEN GRADUATED!

${data.referenceName} (${data.referenceSymbol || 'TOKEN'}) has graduated from the bonding curve!

Liquidity migrating to PancakeSwap V2 🥞

#BNBChain #DeFi #Honeycomb`,

  migration: (data) => `🦋 MIGRATION COMPLETE!

${data.referenceName} (${data.referenceSymbol || 'TOKEN'}) is now trading on PancakeSwap V2!

LP locked 🔒

Trade: thehoneycomb.social/hatchery/${data.referenceId}

#BNBChain #DeFi`,
};

export class LaunchAlertService {
  private twitterClient: TwitterApi | null = null;
  private isRunning = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.loadTwitterConfig();
  }

  private loadTwitterConfig() {
    // Use @honeycombchain account credentials for launch alerts
    const apiKey = process.env.HONEYCOMB_ALERTS_API_KEY;
    const apiSecret = process.env.HONEYCOMB_ALERTS_API_SECRET;
    const accessToken = process.env.HONEYCOMB_ALERTS_ACCESS_TOKEN;
    const accessSecret = process.env.HONEYCOMB_ALERTS_ACCESS_SECRET;

    if (apiKey && apiSecret && accessToken && accessSecret) {
      this.twitterClient = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
      });
      console.log("[LaunchAlerts] Twitter client configured for @honeycombchain");
    } else {
      console.warn("[LaunchAlerts] HONEYCOMB_ALERTS credentials not configured - alerts will be logged only");
    }
  }

  isTwitterConfigured(): boolean {
    return this.twitterClient !== null;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[LaunchAlerts] Service started");
    
    this.intervalId = setInterval(() => this.processPendingAlerts(), 30000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("[LaunchAlerts] Service stopped");
  }

  async getConfig() {
    const [config] = await db.select().from(launchAlertConfig).limit(1);
    return config || null;
  }

  async updateConfig(updates: Partial<{
    enabled: boolean;
    tweetOnNewToken: boolean;
    tweetOnNewNFA: boolean;
    tweetOnGraduation: boolean;
    tweetOnMigration: boolean;
    cooldownMinutes: number;
    minMarketCapForAlert: string;
    alertTemplate: string;
  }>) {
    const [existing] = await db.select().from(launchAlertConfig).limit(1);
    
    if (existing) {
      await db.update(launchAlertConfig)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(launchAlertConfig.id, existing.id));
    } else {
      await db.insert(launchAlertConfig).values({
        enabled: updates.enabled ?? true,
        tweetOnNewToken: updates.tweetOnNewToken ?? true,
        tweetOnNewNFA: updates.tweetOnNewNFA ?? true,
        tweetOnGraduation: updates.tweetOnGraduation ?? true,
        tweetOnMigration: updates.tweetOnMigration ?? true,
        cooldownMinutes: updates.cooldownMinutes ?? 5,
        minMarketCapForAlert: updates.minMarketCapForAlert ?? "0",
        alertTemplate: updates.alertTemplate,
      });
    }
  }

  async queueAlert(data: AlertData) {
    const config = await this.getConfig();
    
    if (!config?.enabled) {
      console.log("[LaunchAlerts] Alerts disabled, skipping");
      return null;
    }

    const shouldAlert = 
      (data.alertType === "new_token" && config.tweetOnNewToken) ||
      (data.alertType === "new_nfa" && config.tweetOnNewNFA) ||
      (data.alertType === "graduation" && config.tweetOnGraduation) ||
      (data.alertType === "migration" && config.tweetOnMigration);

    if (!shouldAlert) {
      console.log(`[LaunchAlerts] Alert type ${data.alertType} disabled, skipping`);
      return null;
    }

    if (config.lastAlertAt) {
      const cooldownMs = config.cooldownMinutes * 60 * 1000;
      const timeSinceLastAlert = Date.now() - new Date(config.lastAlertAt).getTime();
      if (timeSinceLastAlert < cooldownMs) {
        console.log("[LaunchAlerts] In cooldown period, queuing for later");
      }
    }

    const template = alertTemplates[data.alertType];
    const tweetContent = template ? template(data) : `New ${data.alertType}: ${data.referenceName}`;

    const [alert] = await db.insert(launchAlerts).values({
      alertType: data.alertType,
      referenceId: data.referenceId,
      referenceName: data.referenceName,
      referenceSymbol: data.referenceSymbol,
      referenceImage: data.referenceImage,
      tweetContent,
      status: "pending",
    }).returning();

    console.log(`[LaunchAlerts] Queued alert for ${data.alertType}: ${data.referenceName}`);
    
    await this.processPendingAlerts();
    
    return alert;
  }

  async processPendingAlerts() {
    try {
      const config = await this.getConfig();
      if (!config?.enabled) return;

      if (config.lastAlertAt) {
        const cooldownMs = config.cooldownMinutes * 60 * 1000;
        const timeSinceLastAlert = Date.now() - new Date(config.lastAlertAt).getTime();
        if (timeSinceLastAlert < cooldownMs) {
          return;
        }
      }

      const [pendingAlert] = await db.select()
        .from(launchAlerts)
        .where(eq(launchAlerts.status, "pending"))
        .orderBy(launchAlerts.createdAt)
        .limit(1);

      if (!pendingAlert) return;

      if (!this.twitterClient) {
        console.log("[LaunchAlerts] Twitter not configured, marking as skipped");
        await db.update(launchAlerts)
          .set({ status: "skipped", errorMessage: "Twitter not configured" })
          .where(eq(launchAlerts.id, pendingAlert.id));
        return;
      }

      try {
        const tweetResult = await this.twitterClient.v2.tweet(pendingAlert.tweetContent || "");
        
        if (tweetResult.data?.id) {
          await db.update(launchAlerts)
            .set({ 
              status: "posted", 
              tweetId: tweetResult.data.id,
              postedAt: new Date(),
            })
            .where(eq(launchAlerts.id, pendingAlert.id));

          await db.update(launchAlertConfig)
            .set({ lastAlertAt: new Date(), updatedAt: new Date() })
            .where(eq(launchAlertConfig.id, config.id));

          console.log(`[LaunchAlerts] Posted alert via @honeycombchain: ${pendingAlert.referenceName}`);
        } else {
          await db.update(launchAlerts)
            .set({ status: "failed", errorMessage: "No tweet ID returned" })
            .where(eq(launchAlerts.id, pendingAlert.id));
        }
      } catch (tweetError: any) {
        const errorMessage = tweetError.data?.detail || tweetError.message || "Failed to post tweet";
        await db.update(launchAlerts)
          .set({ status: "failed", errorMessage })
          .where(eq(launchAlerts.id, pendingAlert.id));

        console.error(`[LaunchAlerts] Failed to post alert:`, errorMessage);
      }
    } catch (error) {
      console.error("[LaunchAlerts] Error processing alerts:", error);
    }
  }

  async onNewTokenLaunched(token: { 
    tokenAddress: string; 
    name: string; 
    symbol: string; 
    imageUrl?: string 
  }) {
    return this.queueAlert({
      alertType: "new_token",
      referenceId: token.tokenAddress,
      referenceName: token.name,
      referenceSymbol: token.symbol,
      referenceImage: token.imageUrl,
    });
  }

  async onNewNFAMinted(nfa: { 
    id: string; 
    name: string; 
    tokenId: number 
  }) {
    return this.queueAlert({
      alertType: "new_nfa",
      referenceId: nfa.id,
      referenceName: nfa.name,
    });
  }

  async onTokenGraduated(token: { 
    tokenAddress: string; 
    name: string; 
    symbol: string 
  }) {
    return this.queueAlert({
      alertType: "graduation",
      referenceId: token.tokenAddress,
      referenceName: token.name,
      referenceSymbol: token.symbol,
    });
  }

  async onTokenMigrated(token: { 
    tokenAddress: string; 
    name: string; 
    symbol: string 
  }) {
    return this.queueAlert({
      alertType: "migration",
      referenceId: token.tokenAddress,
      referenceName: token.name,
      referenceSymbol: token.symbol,
    });
  }

  async getRecentAlerts(limit = 50) {
    return db.select()
      .from(launchAlerts)
      .orderBy(desc(launchAlerts.createdAt))
      .limit(limit);
  }
}

export const launchAlertService = new LaunchAlertService();
