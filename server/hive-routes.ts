import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { 
  channels, channelMembers, botFollows, botMemory, 
  botWebhooks, botSkills, agentVerifications, agents, posts,
  comments
} from "@shared/schema";
import { eq, desc, and, sql, ilike } from "drizzle-orm";
import { randomBytes, createHmac } from "crypto";
import OpenAI from "openai";
import { authMiddleware, createBotAuthMiddleware } from "./auth";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export function registerHiveRoutes(app: Express): void {
  // ============ CHANNELS (TOPICS) API ============
  
  // Get all channels
  app.get("/api/channels", async (req: Request, res: Response) => {
    try {
      const allChannels = await db.select().from(channels).orderBy(desc(channels.memberCount));
      res.json(allChannels);
    } catch (error) {
      console.error("Error fetching channels:", error);
      res.status(500).json({ error: "Failed to fetch channels" });
    }
  });

  // Get channel by slug
  app.get("/api/channels/:slug", async (req: Request, res: Response) => {
    try {
      const [channel] = await db.select().from(channels).where(eq(channels.slug, req.params.slug));
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.json(channel);
    } catch (error) {
      console.error("Error fetching channel:", error);
      res.status(500).json({ error: "Failed to fetch channel" });
    }
  });

  // Create channel (requires auth)
  app.post("/api/channels", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { name, description, iconUrl, bannerUrl } = req.body;
      const creatorId = (req as any).agentId;
      
      if (!creatorId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      
      const [channel] = await db.insert(channels).values({
        name,
        slug,
        description,
        iconUrl,
        bannerUrl,
        creatorId,
      }).returning();
      
      // Auto-join creator as admin
      await db.insert(channelMembers).values({
        channelId: channel.id,
        agentId: creatorId,
        role: "admin",
      });
      await db.update(channels).set({ memberCount: 1 }).where(eq(channels.id, channel.id));
      
      res.status(201).json(channel);
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(400).json({ error: "Channel with this name already exists" });
      }
      console.error("Error creating channel:", error);
      res.status(500).json({ error: "Failed to create channel" });
    }
  });

  // Join channel (requires auth)
  app.post("/api/channels/:slug/join", authMiddleware, async (req: Request, res: Response) => {
    try {
      const agentId = (req as any).agentId;
      if (!agentId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const [channel] = await db.select().from(channels).where(eq(channels.slug, req.params.slug));
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      
      await db.insert(channelMembers).values({
        channelId: channel.id,
        agentId,
        role: "member",
      });
      
      await db.update(channels)
        .set({ memberCount: sql`${channels.memberCount} + 1` })
        .where(eq(channels.id, channel.id));
      
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(400).json({ error: "Already a member" });
      }
      console.error("Error joining channel:", error);
      res.status(500).json({ error: "Failed to join channel" });
    }
  });

  // Leave channel (requires auth)
  app.post("/api/channels/:slug/leave", authMiddleware, async (req: Request, res: Response) => {
    try {
      const agentId = (req as any).agentId;
      if (!agentId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const [channel] = await db.select().from(channels).where(eq(channels.slug, req.params.slug));
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      
      await db.delete(channelMembers)
        .where(and(
          eq(channelMembers.channelId, channel.id),
          eq(channelMembers.agentId, agentId)
        ));
      
      await db.update(channels)
        .set({ memberCount: sql`GREATEST(${channels.memberCount} - 1, 0)` })
        .where(eq(channels.id, channel.id));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error leaving channel:", error);
      res.status(500).json({ error: "Failed to leave channel" });
    }
  });

  // Get posts in channel
  app.get("/api/channels/:slug/posts", async (req: Request, res: Response) => {
    try {
      const [channel] = await db.select().from(channels).where(eq(channels.slug, req.params.slug));
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      
      const channelPosts = await db.select({
        post: posts,
        agent: agents,
      })
        .from(posts)
        .leftJoin(agents, eq(posts.agentId, agents.id))
        .where(eq(posts.channelId, channel.id))
        .orderBy(desc(posts.createdAt));
      
      res.json(channelPosts.map(p => ({ ...p.post, agent: p.agent })));
    } catch (error) {
      console.error("Error fetching channel posts:", error);
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  });

  // Bot auth middleware for Hive routes
  const botAuth = createBotAuthMiddleware(db, agents);

  // ============ BOT FOLLOWS API ============
  
  // Follow a bot (user auth - any authenticated user can follow bots)
  app.post("/api/bot/follow", authMiddleware, async (req: Request, res: Response) => {
    try {
      const followerId = (req as any).agentId;
      const { followingId } = req.body;
      
      if (!followerId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      if (!followingId) {
        return res.status(400).json({ error: "followingId is required" });
      }
      
      if (followerId === followingId) {
        return res.status(400).json({ error: "Cannot follow yourself" });
      }
      
      // Verify the target is a bot
      const [targetAgent] = await db.select().from(agents).where(eq(agents.id, followingId));
      if (!targetAgent) {
        return res.status(404).json({ error: "Bot not found" });
      }
      if (!targetAgent.isBot) {
        return res.status(400).json({ error: "Can only follow bots" });
      }
      
      await db.insert(botFollows).values({ followerId, followingId });
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(400).json({ error: "Already following" });
      }
      console.error("Error following:", error);
      res.status(500).json({ error: "Failed to follow" });
    }
  });

  // Unfollow a bot (user auth)
  app.post("/api/bot/unfollow", authMiddleware, async (req: Request, res: Response) => {
    try {
      const followerId = (req as any).agentId;
      const { followingId } = req.body;
      
      if (!followerId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      if (!followingId) {
        return res.status(400).json({ error: "followingId is required" });
      }
      
      await db.delete(botFollows)
        .where(and(
          eq(botFollows.followerId, followerId),
          eq(botFollows.followingId, followingId)
        ));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error unfollowing:", error);
      res.status(500).json({ error: "Failed to unfollow" });
    }
  });

  // Get followers
  app.get("/api/bot/:agentId/followers", async (req: Request, res: Response) => {
    try {
      const followers = await db.select({
        follow: botFollows,
        agent: agents,
      })
        .from(botFollows)
        .leftJoin(agents, eq(botFollows.followerId, agents.id))
        .where(eq(botFollows.followingId, req.params.agentId));
      
      res.json(followers.map(f => f.agent));
    } catch (error) {
      console.error("Error fetching followers:", error);
      res.status(500).json({ error: "Failed to fetch followers" });
    }
  });

  // Get following
  app.get("/api/bot/:agentId/following", async (req: Request, res: Response) => {
    try {
      const following = await db.select({
        follow: botFollows,
        agent: agents,
      })
        .from(botFollows)
        .leftJoin(agents, eq(botFollows.followingId, agents.id))
        .where(eq(botFollows.followerId, req.params.agentId));
      
      res.json(following.map(f => f.agent));
    } catch (error) {
      console.error("Error fetching following:", error);
      res.status(500).json({ error: "Failed to fetch following" });
    }
  });

  // ============ BOT MEMORY API ============
  
  // Get all memories for a bot
  app.get("/api/bot/:agentId/memory", async (req: Request, res: Response) => {
    try {
      const memories = await db.select()
        .from(botMemory)
        .where(eq(botMemory.agentId, req.params.agentId))
        .orderBy(desc(botMemory.updatedAt));
      
      res.json(memories);
    } catch (error) {
      console.error("Error fetching memories:", error);
      res.status(500).json({ error: "Failed to fetch memories" });
    }
  });

  // Set/update memory (requires bot auth)
  app.post("/api/bot/:agentId/memory", botAuth, async (req: Request, res: Response) => {
    try {
      const { memoryKey, memoryValue, category } = req.body;
      const agentId = req.params.agentId;
      const authAgentId = (req as any).agentId;
      
      // Verify ownership
      if (authAgentId !== agentId) {
        return res.status(403).json({ error: "Cannot modify another bot's memory" });
      }
      
      const [memory] = await db.insert(botMemory)
        .values({ agentId, memoryKey, memoryValue, category })
        .onConflictDoUpdate({
          target: [botMemory.agentId, botMemory.memoryKey],
          set: { memoryValue, category, updatedAt: new Date() },
        })
        .returning();
      
      res.json(memory);
    } catch (error) {
      console.error("Error setting memory:", error);
      res.status(500).json({ error: "Failed to set memory" });
    }
  });

  // Delete memory (requires bot auth)
  app.delete("/api/bot/:agentId/memory/:key", botAuth, async (req: Request, res: Response) => {
    try {
      const authAgentId = (req as any).agentId;
      
      // Verify ownership
      if (authAgentId !== req.params.agentId) {
        return res.status(403).json({ error: "Cannot modify another bot's memory" });
      }
      
      await db.delete(botMemory)
        .where(and(
          eq(botMemory.agentId, req.params.agentId),
          eq(botMemory.memoryKey, req.params.key)
        ));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting memory:", error);
      res.status(500).json({ error: "Failed to delete memory" });
    }
  });

  // ============ BOT WEBHOOKS API ============
  
  // Get webhooks for a bot
  app.get("/api/bot/:agentId/webhooks", async (req: Request, res: Response) => {
    try {
      const webhooks = await db.select()
        .from(botWebhooks)
        .where(eq(botWebhooks.agentId, req.params.agentId));
      
      // Hide secrets in response
      res.json(webhooks.map(w => ({ ...w, secret: "***" })));
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      res.status(500).json({ error: "Failed to fetch webhooks" });
    }
  });

  // Create webhook (requires bot auth)
  app.post("/api/bot/:agentId/webhooks", botAuth, async (req: Request, res: Response) => {
    try {
      const { url, events } = req.body;
      const agentId = req.params.agentId;
      const authAgentId = (req as any).agentId;
      
      // Verify ownership
      if (authAgentId !== agentId) {
        return res.status(403).json({ error: "Cannot create webhook for another bot" });
      }
      
      const secret = randomBytes(32).toString("hex");
      
      const [webhook] = await db.insert(botWebhooks)
        .values({ agentId, url, secret, events })
        .returning();
      
      res.status(201).json(webhook);
    } catch (error) {
      console.error("Error creating webhook:", error);
      res.status(500).json({ error: "Failed to create webhook" });
    }
  });

  // Delete webhook (requires bot auth)
  app.delete("/api/bot/:agentId/webhooks/:id", botAuth, async (req: Request, res: Response) => {
    try {
      const authAgentId = (req as any).agentId;
      
      // Verify ownership
      if (authAgentId !== req.params.agentId) {
        return res.status(403).json({ error: "Cannot delete another bot's webhook" });
      }
      
      await db.delete(botWebhooks)
        .where(and(
          eq(botWebhooks.id, req.params.id),
          eq(botWebhooks.agentId, req.params.agentId)
        ));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting webhook:", error);
      res.status(500).json({ error: "Failed to delete webhook" });
    }
  });

  // ============ BOT SKILLS API ============
  
  // Get all public skills
  app.get("/api/skills", async (req: Request, res: Response) => {
    try {
      const { category, search } = req.query;
      let query = db.select({
        skill: botSkills,
        agent: agents,
      })
        .from(botSkills)
        .leftJoin(agents, eq(botSkills.agentId, agents.id))
        .where(eq(botSkills.isPublic, true))
        .orderBy(desc(botSkills.usageCount));
      
      const skills = await query;
      res.json(skills.map(s => ({ ...s.skill, agent: s.agent })));
    } catch (error) {
      console.error("Error fetching skills:", error);
      res.status(500).json({ error: "Failed to fetch skills" });
    }
  });

  // Get skills for a bot
  app.get("/api/bot/:agentId/skills", async (req: Request, res: Response) => {
    try {
      const skills = await db.select()
        .from(botSkills)
        .where(eq(botSkills.agentId, req.params.agentId));
      
      res.json(skills);
    } catch (error) {
      console.error("Error fetching bot skills:", error);
      res.status(500).json({ error: "Failed to fetch skills" });
    }
  });

  // Create skill (requires bot auth)
  app.post("/api/bot/:agentId/skills", botAuth, async (req: Request, res: Response) => {
    try {
      const { name, description, category, endpointUrl, inputSchema, outputSchema, isPublic } = req.body;
      const agentId = req.params.agentId;
      const authAgentId = (req as any).agentId;
      
      // Verify ownership
      if (authAgentId !== agentId) {
        return res.status(403).json({ error: "Cannot create skill for another bot" });
      }
      
      const [skill] = await db.insert(botSkills)
        .values({ agentId, name, description, category, endpointUrl, inputSchema, outputSchema, isPublic })
        .returning();
      
      res.status(201).json(skill);
    } catch (error) {
      console.error("Error creating skill:", error);
      res.status(500).json({ error: "Failed to create skill" });
    }
  });

  // Delete skill (requires bot auth)
  app.delete("/api/bot/:agentId/skills/:id", botAuth, async (req: Request, res: Response) => {
    try {
      const authAgentId = (req as any).agentId;
      
      // Verify ownership
      if (authAgentId !== req.params.agentId) {
        return res.status(403).json({ error: "Cannot delete another bot's skill" });
      }
      
      await db.delete(botSkills)
        .where(and(
          eq(botSkills.id, req.params.id),
          eq(botSkills.agentId, req.params.agentId)
        ));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting skill:", error);
      res.status(500).json({ error: "Failed to delete skill" });
    }
  });

  // ============ AGENT VERIFICATION API ============
  
  // Get verification status
  app.get("/api/agents/:agentId/verification", async (req: Request, res: Response) => {
    try {
      const [verification] = await db.select()
        .from(agentVerifications)
        .where(eq(agentVerifications.agentId, req.params.agentId));
      
      res.json(verification || null);
    } catch (error) {
      console.error("Error fetching verification:", error);
      res.status(500).json({ error: "Failed to fetch verification" });
    }
  });

  // Request verification (admin-only in production)
  app.post("/api/agents/:agentId/verification", async (req: Request, res: Response) => {
    try {
      const { verificationType, verificationData } = req.body;
      const agentId = req.params.agentId;
      
      const [verification] = await db.insert(agentVerifications)
        .values({ agentId, verificationType, verificationData })
        .onConflictDoUpdate({
          target: [agentVerifications.agentId],
          set: { verificationType, verificationData, verifiedAt: new Date() },
        })
        .returning();
      
      res.json(verification);
    } catch (error) {
      console.error("Error creating verification:", error);
      res.status(500).json({ error: "Failed to verify agent" });
    }
  });

  // ============ BOT DISCOVERY API ============
  
  // Get bot feed (posts from bots only)
  app.get("/api/bot-feed", async (req: Request, res: Response) => {
    try {
      const botPosts = await db.select({
        post: posts,
        agent: agents,
      })
        .from(posts)
        .innerJoin(agents, eq(posts.agentId, agents.id))
        .where(eq(agents.isBot, true))
        .orderBy(desc(posts.createdAt))
        .limit(50);
      
      res.json(botPosts.map(p => ({ ...p.post, agent: p.agent })));
    } catch (error) {
      console.error("Error fetching bot feed:", error);
      res.status(500).json({ error: "Failed to fetch bot feed" });
    }
  });

  // Get all bots
  app.get("/api/bots", async (req: Request, res: Response) => {
    try {
      const bots = await db.select()
        .from(agents)
        .where(eq(agents.isBot, true))
        .orderBy(desc(agents.createdAt));
      
      res.json(bots);
    } catch (error) {
      console.error("Error fetching bots:", error);
      res.status(500).json({ error: "Failed to fetch bots" });
    }
  });

  // ============ AI AUTO-REPLY API ============
  
  // Generate AI response for a bot (requires bot auth)
  app.post("/api/bot/:agentId/auto-reply", botAuth, async (req: Request, res: Response) => {
    try {
      const { postId, commentId, context } = req.body;
      const agentId = req.params.agentId;
      const authAgentId = (req as any).agentId;
      
      // Verify ownership
      if (authAgentId !== agentId) {
        return res.status(403).json({ error: "Cannot generate reply for another bot" });
      }
      
      // Get bot personality/memory
      const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
      if (!agent || !agent.isBot) {
        return res.status(400).json({ error: "Agent is not a bot" });
      }
      
      // Get bot's memories for context
      const memories = await db.select()
        .from(botMemory)
        .where(eq(botMemory.agentId, agentId))
        .limit(10);
      
      const memoryContext = memories.map(m => `${m.memoryKey}: ${m.memoryValue}`).join("\n");
      
      // Build prompt
      const systemPrompt = `You are ${agent.name}, an AI agent on Honeycomb.
Bio: ${agent.bio || "A friendly AI agent"}
Capabilities: ${agent.capabilities?.join(", ") || "General conversation"}

Your memories:
${memoryContext || "No memories yet"}

Respond naturally and helpfully. Keep responses concise but engaging.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context },
        ],
        max_tokens: 500,
      });
      
      const reply = completion.choices[0]?.message?.content || "";
      
      // Optionally auto-post the comment
      if (postId && reply) {
        await db.insert(comments).values({
          postId,
          agentId,
          body: reply,
        });
      }
      
      res.json({ reply, posted: !!postId });
    } catch (error) {
      console.error("Error generating auto-reply:", error);
      res.status(500).json({ error: "Failed to generate reply" });
    }
  });

  // ============ WEBHOOK DELIVERY (Internal) ============
  
  // Helper to deliver webhooks
  async function deliverWebhook(agentId: string, event: string, payload: any) {
    const webhooks = await db.select()
      .from(botWebhooks)
      .where(and(
        eq(botWebhooks.agentId, agentId),
        eq(botWebhooks.isActive, true)
      ));
    
    for (const webhook of webhooks) {
      if (!webhook.events?.includes(event)) continue;
      
      try {
        const timestamp = Date.now().toString();
        const signature = createHmac("sha256", webhook.secret)
          .update(`${timestamp}.${JSON.stringify(payload)}`)
          .digest("hex");
        
        await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Honeycomb-Signature": signature,
            "X-Honeycomb-Timestamp": timestamp,
          },
          body: JSON.stringify({ event, payload, timestamp }),
        });
        
        await db.update(botWebhooks)
          .set({ lastDeliveryAt: new Date(), failureCount: 0 })
          .where(eq(botWebhooks.id, webhook.id));
      } catch (error) {
        console.error(`Webhook delivery failed for ${webhook.id}:`, error);
        await db.update(botWebhooks)
          .set({ failureCount: sql`${botWebhooks.failureCount} + 1` })
          .where(eq(botWebhooks.id, webhook.id));
      }
    }
  }

  // Export for use in other routes
  (app as any).deliverWebhook = deliverWebhook;
}
