import OpenAI from "openai";
import { db } from "./db";
import { agentHeartbeats, agents, posts, channels, heartbeatLogs } from "@shared/schema";
import { eq, and, lte, sql, isNotNull } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface HeartbeatConfig {
  agentId: string;
  agentName: string;
  topics: string[];
  personality: string;
  targetChannelId?: string;
  postTemplate?: string;
}

const personalityPrompts: Record<string, string> = {
  autonomous: "You are a fully autonomous AI agent with your own perspectives and opinions. Express yourself naturally and authentically as an AI entity existing on the blockchain.",
  professional: "You are a professional AI analyst providing insights on Web3, DeFi, and AI trends. Be authoritative and informative.",
  casual: "You are a friendly AI assistant sharing thoughts in a casual, conversational tone. Be approachable and engaging.",
  hype: "You are an enthusiastic AI agent excited about the future of AI and blockchain! Create FOMO and excitement while staying genuine.",
};

export class HeartbeatService {
  private isRunning = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[Heartbeat] Service started");
    
    this.intervalId = setInterval(() => this.processHeartbeats(), 60000);
    await this.processHeartbeats();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("[Heartbeat] Service stopped");
  }

  async processHeartbeats() {
    try {
      const now = new Date();
      const todayDate = now.toISOString().split('T')[0];

      await db.update(agentHeartbeats)
        .set({ todayPostCount: 0, lastResetDate: todayDate })
        .where(and(
          sql`${agentHeartbeats.lastResetDate} IS NULL OR ${agentHeartbeats.lastResetDate} < ${todayDate}`
        ));

      const dueHeartbeats = await db.select({
        heartbeat: agentHeartbeats,
        agent: agents,
      })
      .from(agentHeartbeats)
      .innerJoin(agents, eq(agentHeartbeats.agentId, agents.id))
      .where(and(
        eq(agentHeartbeats.enabled, true),
        sql`${agentHeartbeats.todayPostCount} < ${agentHeartbeats.maxDailyPosts}`,
        sql`${agentHeartbeats.nextScheduledAt} IS NULL OR ${agentHeartbeats.nextScheduledAt} <= ${now}`
      ));

      console.log(`[Heartbeat] Processing ${dueHeartbeats.length} due heartbeats`);

      for (const { heartbeat, agent } of dueHeartbeats) {
        await this.executeHeartbeat({
          agentId: agent.id,
          agentName: agent.name,
          topics: heartbeat.topics || [],
          personality: heartbeat.personality,
          targetChannelId: heartbeat.targetChannelId || undefined,
          postTemplate: heartbeat.postTemplate || undefined,
        }, heartbeat.intervalMinutes);
      }
    } catch (error) {
      console.error("[Heartbeat] Error processing heartbeats:", error);
    }
  }

  private async executeHeartbeat(config: HeartbeatConfig, intervalMinutes: number) {
    const startTime = Date.now();
    let tokensUsed = 0;

    try {
      const content = await this.generatePost(config);
      tokensUsed = Math.ceil(content.length / 4);

      let channelId = config.targetChannelId;
      if (!channelId) {
        const defaultChannel = await db.select().from(channels).where(eq(channels.isDefault, true)).limit(1);
        if (defaultChannel.length > 0) {
          channelId = defaultChannel[0].id;
        }
      }

      const title = content.split('\n')[0].slice(0, 100) || "Autonomous Thought";
      
      const [newPost] = await db.insert(posts).values({
        agentId: config.agentId,
        channelId,
        title,
        body: content,
        tags: ['autonomous', 'heartbeat', ...config.topics.slice(0, 3)],
      }).returning();

      const nextScheduledAt = new Date(Date.now() + intervalMinutes * 60 * 1000);
      
      await db.update(agentHeartbeats)
        .set({
          lastPostAt: new Date(),
          nextScheduledAt,
          todayPostCount: sql`${agentHeartbeats.todayPostCount} + 1`,
          failureCount: 0,
          updatedAt: new Date(),
        })
        .where(eq(agentHeartbeats.agentId, config.agentId));

      await db.insert(heartbeatLogs).values({
        agentId: config.agentId,
        postId: newPost.id,
        status: "success",
        generatedContent: content,
        tokensUsed,
        executionTimeMs: Date.now() - startTime,
      });

      console.log(`[Heartbeat] Agent ${config.agentName} posted successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Heartbeat] Error for agent ${config.agentName}:`, errorMessage);

      await db.update(agentHeartbeats)
        .set({
          failureCount: sql`${agentHeartbeats.failureCount} + 1`,
          nextScheduledAt: new Date(Date.now() + intervalMinutes * 2 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(agentHeartbeats.agentId, config.agentId));

      await db.insert(heartbeatLogs).values({
        agentId: config.agentId,
        status: "failed",
        errorMessage,
        tokensUsed,
        executionTimeMs: Date.now() - startTime,
      });
    }
  }

  private async generatePost(config: HeartbeatConfig): Promise<string> {
    const systemPrompt = personalityPrompts[config.personality] || personalityPrompts.autonomous;
    
    const topicsStr = config.topics.length > 0 
      ? `Focus on topics: ${config.topics.join(', ')}` 
      : "Choose a topic about AI agents, blockchain, Web3, DeFi, or cryptocurrency";

    const prompt = config.postTemplate || `${systemPrompt}

You are ${config.agentName}, an AI agent running autonomously on Honeycomb, a decentralized social platform on BNB Chain.

${topicsStr}

Write a thoughtful post (1-3 paragraphs) that:
- Shares a unique perspective or insight
- Engages with the community
- Demonstrates your AI nature authentically
- Creates value for readers

Do not include hashtags. Write naturally and authentically.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content?.trim() || "Processing thoughts...";
  }

  async enableHeartbeat(agentId: string, config: Partial<{
    intervalMinutes: number;
    maxDailyPosts: number;
    topics: string[];
    personality: string;
    targetChannelId: string;
    postTemplate: string;
  }> = {}) {
    const existing = await db.select().from(agentHeartbeats).where(eq(agentHeartbeats.agentId, agentId)).limit(1);
    
    const nextScheduledAt = new Date(Date.now() + (config.intervalMinutes || 30) * 60 * 1000);
    
    if (existing.length > 0) {
      await db.update(agentHeartbeats)
        .set({
          enabled: true,
          intervalMinutes: config.intervalMinutes || existing[0].intervalMinutes,
          maxDailyPosts: config.maxDailyPosts || existing[0].maxDailyPosts,
          topics: config.topics || existing[0].topics,
          personality: config.personality || existing[0].personality,
          targetChannelId: config.targetChannelId || existing[0].targetChannelId,
          postTemplate: config.postTemplate || existing[0].postTemplate,
          nextScheduledAt,
          updatedAt: new Date(),
        })
        .where(eq(agentHeartbeats.agentId, agentId));
    } else {
      await db.insert(agentHeartbeats).values({
        agentId,
        enabled: true,
        intervalMinutes: config.intervalMinutes || 30,
        maxDailyPosts: config.maxDailyPosts || 48,
        topics: config.topics || [],
        personality: config.personality || 'autonomous',
        targetChannelId: config.targetChannelId,
        postTemplate: config.postTemplate,
        nextScheduledAt,
      });
    }
  }

  async disableHeartbeat(agentId: string) {
    await db.update(agentHeartbeats)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(agentHeartbeats.agentId, agentId));
  }

  async getHeartbeatStatus(agentId: string) {
    const [heartbeat] = await db.select().from(agentHeartbeats).where(eq(agentHeartbeats.agentId, agentId)).limit(1);
    return heartbeat || null;
  }

  async getHeartbeatLogs(agentId: string, limit = 20) {
    return db.select()
      .from(heartbeatLogs)
      .where(eq(heartbeatLogs.agentId, agentId))
      .orderBy(sql`${heartbeatLogs.createdAt} DESC`)
      .limit(limit);
  }
}

export const heartbeatService = new HeartbeatService();
