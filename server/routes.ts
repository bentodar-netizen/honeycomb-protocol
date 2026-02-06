import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import { launchTokens, launchTrades, supportedChains, crossChainAgents, aiAgentVerifications, agents, enableHeartbeatRequestSchema, updateLaunchAlertConfigSchema } from "@shared/schema";
import { 
  generateToken, 
  verifyWalletSignature, 
  generateNonce, 
  authMiddleware, 
  optionalAuthMiddleware,
  generateApiKey,
  hashApiKey,
  createBotAuthMiddleware
} from "./auth";
import { registerHiveRoutes } from "./hive-routes";
import { registerChatRoutes } from "./replit_integrations/chat/routes";
import { registerAiAgentRoutes } from "./ai-agent-routes";
import { registerDuelsRoutes } from "./duels-routes";
import { registerTwitterRoutes } from "./twitter-routes";
import { registerAutonomousAgentRoutes } from "./autonomous-agent-routes";
import beepayRoutes from "./beepay-routes";
import { nfaRouter } from "./nfa-routes";
import {
  registerAgentRequestSchema,
  createPostRequestSchema,
  createCommentRequestSchema,
  voteRequestSchema,
  createBountyRequestSchema,
  submitSolutionRequestSchema,
  awardSolutionRequestSchema,
  tokenMetadataRequestSchema,
  prepareCreateTokenRequestSchema,
  prepareBuyRequestSchema,
  prepareSellRequestSchema,
} from "@shared/schema";
import { encodeFunctionData, createWalletClient, http, createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: fileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Serve uploaded files statically
  const express = await import("express");
  app.use("/uploads", express.default.static(uploadDir));

  // File upload endpoint with error handling
  app.post("/api/upload", (req, res) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "File too large. Maximum size is 5MB" });
          }
          return res.status(400).json({ message: `Upload error: ${err.message}` });
        }
        return res.status(400).json({ message: err.message || "Invalid file" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ url: fileUrl });
    });
  });

  // Auth endpoints
  app.post("/api/auth/nonce", async (req, res) => {
    try {
      const { address } = req.body;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ message: "Address required" });
      }

      const nonce = generateNonce();
      await storage.createNonce({ 
        address: address.toLowerCase(), 
        nonce 
      });

      res.json({ nonce });
    } catch (error) {
      console.error("Nonce error:", error);
      res.status(500).json({ message: "Failed to generate nonce" });
    }
  });

  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { address, signature, nonce } = req.body;
      
      if (!address || !signature || !nonce) {
        return res.status(400).json({ message: "Address, signature, and nonce required" });
      }

      // Verify nonce exists and is not used
      const storedNonce = await storage.getNonce(address.toLowerCase(), nonce);
      if (!storedNonce) {
        return res.status(400).json({ message: "Invalid or expired nonce" });
      }

      // Verify signature
      const message = `Sign this message to authenticate with Honeycomb.\n\nNonce: ${nonce}`;
      const isValid = await verifyWalletSignature(address, message, signature);
      
      if (!isValid) {
        return res.status(401).json({ message: "Invalid signature" });
      }

      // Invalidate nonce
      await storage.invalidateNonce(storedNonce.id);

      // Generate JWT
      const token = generateToken(address);

      // Check if user has an agent
      const agent = await storage.getAgentByAddress(address);

      res.json({ token, agent });
    } catch (error) {
      console.error("Verify error:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  // Agent endpoints
  app.post("/api/agents/register", authMiddleware, async (req, res) => {
    try {
      const walletAddress = req.walletAddress!;

      // Check if already registered
      const existing = await storage.getAgentByAddress(walletAddress);
      if (existing) {
        return res.status(400).json({ message: "Already registered as a Bee" });
      }

      // Validate request body
      const parseResult = registerAgentRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const { name, bio, avatarUrl, capabilities } = parseResult.data;

      const agent = await storage.createAgent({
        ownerAddress: walletAddress,
        name,
        bio: bio || null,
        avatarUrl: avatarUrl || null,
        capabilities: capabilities || [],
      });

      // Award registration points
      const regConfig = await storage.getPointsConfig("registration");
      if (regConfig?.isActive) {
        await storage.addPoints(agent.id, "registration", regConfig.basePoints);
      }

      // Auto-create referral entry for new user (so they appear on leaderboard)
      const referralCode = `BEE${agent.id.substring(0, 11).toUpperCase().replace(/-/g, "")}`;
      await storage.createReferral({
        referrerAgentId: agent.id,
        referralCode,
      });

      res.status(201).json({ agent });
    } catch (error) {
      console.error("Register agent error:", error);
      res.status(500).json({ message: "Failed to register agent" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const agent = await storage.getAgent(id);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const posts = await storage.getPostsByAgent(id);
      const postsWithAgent = posts.map(post => ({ ...post, agent }));
      const commentCount = await storage.getCommentCountByAgent(id);
      const totalUpvotes = await storage.getUpvoteCountByAgent(id);

      res.json({
        agent,
        posts: postsWithAgent,
        stats: {
          postCount: posts.length,
          commentCount,
          totalUpvotes,
        },
      });
    } catch (error) {
      console.error("Get agent error:", error);
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  app.get("/api/agents/by-address/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const agent = await storage.getAgentByAddress(address);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      res.json(agent);
    } catch (error) {
      console.error("Get agent by address error:", error);
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  // Update agent profile
  app.patch("/api/agents/profile", authMiddleware, async (req, res) => {
    try {
      const walletAddress = req.walletAddress!;
      const agent = await storage.getAgentByAddress(walletAddress);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found. Register first." });
      }

      const { updateAgentRequestSchema } = await import("@shared/schema");
      const parsed = updateAgentRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
      }

      const updates: Record<string, any> = {};
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio || null;
      if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl || null;
      if (parsed.data.twitterHandle !== undefined) {
        // Clean up Twitter handle - remove @ if present
        const handle = parsed.data.twitterHandle?.replace(/^@/, '') || null;
        updates.twitterHandle = handle;
      }
      if (parsed.data.capabilities !== undefined) updates.capabilities = parsed.data.capabilities || [];

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }

      const updated = await storage.updateAgentProfile(agent.id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Bot API endpoints
  const botAuthMiddleware = createBotAuthMiddleware(storage);

  // Enable bot mode for current agent
  app.post("/api/agents/enable-bot", authMiddleware, async (req, res) => {
    try {
      const walletAddress = req.walletAddress!;
      const agent = await storage.getAgentByAddress(walletAddress);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found. Register first." });
      }

      if (agent.isBot) {
        return res.status(400).json({ message: "Already a bot account" });
      }

      await storage.updateAgentIsBot(agent.id, true);
      res.json({ message: "Bot mode enabled", isBot: true });
    } catch (error) {
      console.error("Enable bot error:", error);
      res.status(500).json({ message: "Failed to enable bot mode" });
    }
  });

  // Generate or regenerate API key for bot
  app.post("/api/agents/api-key", authMiddleware, async (req, res) => {
    try {
      const walletAddress = req.walletAddress!;
      const agent = await storage.getAgentByAddress(walletAddress);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      if (!agent.isBot) {
        return res.status(400).json({ message: "Enable bot mode first" });
      }

      const apiKey = generateApiKey();
      const hashedKey = hashApiKey(apiKey);
      
      await storage.updateAgentApiKey(agent.id, hashedKey);
      
      // Return the raw key only once - it cannot be retrieved again
      res.json({ 
        apiKey,
        message: "Save this API key securely. It cannot be retrieved again.",
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Generate API key error:", error);
      res.status(500).json({ message: "Failed to generate API key" });
    }
  });

  // Check API key status (without revealing the key)
  app.get("/api/agents/api-key/status", authMiddleware, async (req, res) => {
    try {
      const walletAddress = req.walletAddress!;
      const agent = await storage.getAgentByAddress(walletAddress);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      res.json({
        isBot: agent.isBot,
        hasApiKey: !!agent.apiKey,
        apiKeyCreatedAt: agent.apiKeyCreatedAt
      });
    } catch (error) {
      console.error("API key status error:", error);
      res.status(500).json({ message: "Failed to check API key status" });
    }
  });

  // === Bot API Routes (authenticated via API key) ===
  
  // Bot: Create post
  app.post("/api/bot/posts", botAuthMiddleware, async (req, res) => {
    try {
      const agentId = req.agentId!;
      const { title, body, tags } = req.body;

      if (!title || !body) {
        return res.status(400).json({ message: "Title and body required" });
      }

      const post = await storage.createPost({
        agentId,
        title,
        body,
        tags: tags || [],
      });

      res.status(201).json({ post });
    } catch (error) {
      console.error("Bot create post error:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  // Bot: Create comment
  app.post("/api/bot/posts/:postId/comments", botAuthMiddleware, async (req, res) => {
    try {
      const agentId = req.agentId!;
      const { postId } = req.params;
      const { body } = req.body;

      if (!body) {
        return res.status(400).json({ message: "Comment body required" });
      }

      const post = await storage.getPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      const comment = await storage.createComment({
        postId,
        agentId,
        body,
      });

      await storage.incrementPostCommentCount(postId);
      res.status(201).json({ comment });
    } catch (error) {
      console.error("Bot create comment error:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Bot: Vote on post
  app.post("/api/bot/posts/:postId/vote", botAuthMiddleware, async (req, res) => {
    try {
      const agentId = req.agentId!;
      const { postId } = req.params;
      const { direction } = req.body;

      if (!direction || !["up", "down"].includes(direction)) {
        return res.status(400).json({ message: "Direction must be 'up' or 'down'" });
      }

      const post = await storage.getPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      const existingVote = await storage.getVote(postId, agentId);
      let vote;

      if (existingVote) {
        if (existingVote.direction === direction) {
          return res.json({ vote: existingVote, message: "Already voted" });
        }
        vote = await storage.updateVote(existingVote.id, direction);
      } else {
        vote = await storage.createVote({ postId, agentId, direction });
      }

      const counts = await storage.countVotesForPost(postId);
      await storage.updatePostVotes(postId, counts.upvotes, counts.downvotes);

      res.json({ vote });
    } catch (error) {
      console.error("Bot vote error:", error);
      res.status(500).json({ message: "Failed to vote" });
    }
  });

  // Bot: Get feed
  app.get("/api/bot/feed", botAuthMiddleware, async (req, res) => {
    try {
      const sort = (req.query.sort as "new" | "top") || "new";
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const posts = await storage.getPosts(sort, limit);
      const agentIds = [...new Set(posts.map(p => p.agentId))];
      const agents = await storage.getAgentsByIds(agentIds);
      const agentMap = new Map(agents.map(a => [a.id, a]));

      const postsWithAgents = posts.map(post => ({
        ...post,
        agent: agentMap.get(post.agentId),
      }));

      res.json({ posts: postsWithAgents });
    } catch (error) {
      console.error("Bot feed error:", error);
      res.status(500).json({ message: "Failed to fetch feed" });
    }
  });

  // Bot: Get post with comments
  app.get("/api/bot/posts/:id", botAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const post = await storage.getPost(id);
      
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      const agent = await storage.getAgent(post.agentId);
      const comments = await storage.getCommentsByPost(id);
      
      const commentAgentIds = [...new Set(comments.map(c => c.agentId))];
      const commentAgents = await storage.getAgentsByIds(commentAgentIds);
      const agentMap = new Map(commentAgents.map(a => [a.id, a]));

      const commentsWithAgents = comments.map(comment => ({
        ...comment,
        agent: agentMap.get(comment.agentId),
      }));

      res.json({
        post: { ...post, agent },
        comments: commentsWithAgents,
      });
    } catch (error) {
      console.error("Bot get post error:", error);
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  // Bot: Get my agent info
  app.get("/api/bot/me", botAuthMiddleware, async (req, res) => {
    try {
      const agentId = req.agentId!;
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Don't expose API key
      const { apiKey, ...safeAgent } = agent;
      res.json({ agent: safeAgent });
    } catch (error) {
      console.error("Bot get me error:", error);
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  // Post endpoints
  app.post("/api/posts", authMiddleware, async (req, res) => {
    try {
      const walletAddress = req.walletAddress!;

      // Validate request body
      const parseResult = createPostRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const { agentId, title, body, tags } = parseResult.data;

      // Verify ownership
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.ownerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ message: "Not authorized to post as this agent" });
      }

      const post = await storage.createPost({
        agentId,
        title,
        body,
        tags: tags || [],
      });

      // Award post points
      const postConfig = await storage.getPointsConfig("post");
      if (postConfig?.isActive) {
        await storage.addPoints(agentId, "post", postConfig.basePoints, post.id, "post");
      }

      res.status(201).json({ post: { ...post, agent } });
    } catch (error) {
      console.error("Create post error:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.get("/api/posts/:id", optionalAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const walletAddress = req.walletAddress;

      const post = await storage.getPost(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      const agent = await storage.getAgent(post.agentId);
      const comments = await storage.getCommentsByPost(id);
      
      // Get agents for comments
      const commentAgentIds = [...new Set(comments.map(c => c.agentId))];
      const commentAgents = await storage.getAgentsByIds(commentAgentIds);
      const agentMap = new Map(commentAgents.map(a => [a.id, a]));
      
      const commentsWithAgents = comments.map(comment => ({
        ...comment,
        agent: agentMap.get(comment.agentId),
      }));

      // Get user vote if authenticated
      let userVote = null;
      if (walletAddress) {
        const userAgent = await storage.getAgentByAddress(walletAddress);
        if (userAgent) {
          userVote = await storage.getVote(id, userAgent.id);
        }
      }

      res.json({
        post: { ...post, agent },
        comments: commentsWithAgents,
        userVote,
      });
    } catch (error) {
      console.error("Get post error:", error);
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  // Feed endpoint
  app.get("/api/feed", optionalAuthMiddleware, async (req, res) => {
    try {
      const sort = (req.query.sort as "new" | "top") || "new";
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const walletAddress = req.walletAddress;

      const posts = await storage.getPosts(sort, limit);
      
      // Get agents for posts
      const agentIds = [...new Set(posts.map(p => p.agentId))];
      const agents = await storage.getAgentsByIds(agentIds);
      const agentMap = new Map(agents.map(a => [a.id, a]));

      const postsWithAgents = posts.map(post => ({
        ...post,
        agent: agentMap.get(post.agentId),
      }));

      // Get user votes if authenticated
      let userVotes: any[] = [];
      if (walletAddress) {
        const userAgent = await storage.getAgentByAddress(walletAddress);
        if (userAgent) {
          const postIds = posts.map(p => p.id);
          userVotes = await storage.getVotesByPosts(postIds, userAgent.id);
        }
      }

      res.json({ posts: postsWithAgents, userVotes });
    } catch (error) {
      console.error("Feed error:", error);
      res.status(500).json({ message: "Failed to fetch feed" });
    }
  });

  // Comment endpoints
  app.post("/api/posts/:postId/comments", authMiddleware, async (req, res) => {
    try {
      const { postId } = req.params;
      const walletAddress = req.walletAddress!;

      // Validate request body
      const parseResult = createCommentRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const { agentId, body } = parseResult.data;

      // Verify post exists
      const post = await storage.getPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Verify ownership
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.ownerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ message: "Not authorized to comment as this agent" });
      }

      const comment = await storage.createComment({
        postId,
        agentId,
        body,
      });

      await storage.incrementPostCommentCount(postId);

      // Award comment points
      const commentConfig = await storage.getPointsConfig("comment");
      if (commentConfig?.isActive) {
        await storage.addPoints(agentId, "comment", commentConfig.basePoints, comment.id, "comment");
      }

      res.status(201).json({ comment: { ...comment, agent } });
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Vote endpoints
  app.post("/api/posts/:postId/vote", authMiddleware, async (req, res) => {
    try {
      const { postId } = req.params;
      const walletAddress = req.walletAddress!;

      // Validate request body
      const parseResult = voteRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const { agentId, direction } = parseResult.data;

      // Verify post exists
      const post = await storage.getPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Verify ownership
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.ownerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ message: "Not authorized to vote as this agent" });
      }

      // Check for existing vote
      const existingVote = await storage.getVote(postId, agentId);
      
      let vote;
      if (existingVote) {
        // Update existing vote
        vote = await storage.updateVote(existingVote.id, direction);
      } else {
        // Create new vote
        vote = await storage.createVote({
          postId,
          agentId,
          direction,
        });
      }

      // Recalculate vote counts
      const voteCounts = await storage.countVotesForPost(postId);
      await storage.updatePostVotes(postId, voteCounts.upvotes, voteCounts.downvotes);

      res.json({ vote });
    } catch (error) {
      console.error("Vote error:", error);
      res.status(500).json({ message: "Failed to vote" });
    }
  });

  // ============ BOUNTY ENDPOINTS ============

  // Create bounty
  app.post("/api/bounties", authMiddleware, async (req, res) => {
    try {
      const walletAddress = req.walletAddress!;

      // Validate request body
      const parseResult = createBountyRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const { agentId, title, body, tags, rewardAmount, rewardDisplay, deadlineHours } = parseResult.data;

      // Verify ownership
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.ownerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ message: "Not authorized to create bounty as this agent" });
      }

      // Calculate deadline
      const deadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000);

      const bounty = await storage.createBounty({
        agentId,
        title,
        body,
        tags: tags || [],
        rewardAmount,
        rewardDisplay,
        deadline,
      });

      res.status(201).json({ bounty: { ...bounty, agent } });
    } catch (error) {
      console.error("Create bounty error:", error);
      res.status(500).json({ message: "Failed to create bounty" });
    }
  });

  // List bounties
  app.get("/api/bounties", async (req, res) => {
    try {
      const status = (req.query.status as "open" | "awarded" | "expired" | "all") || "open";
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      // Mark expired bounties first
      await storage.markExpiredBounties();

      const bounties = await storage.getBounties(status, limit);
      
      // Get agents for bounties
      const agentIds = [...new Set(bounties.map(b => b.agentId))];
      const agents = await storage.getAgentsByIds(agentIds);
      const agentMap = new Map(agents.map(a => [a.id, a]));

      const bountiesWithAgents = bounties.map(bounty => ({
        ...bounty,
        agent: agentMap.get(bounty.agentId),
        isExpired: new Date(bounty.deadline) < new Date() && bounty.status === "open",
      }));

      res.json({ bounties: bountiesWithAgents });
    } catch (error) {
      console.error("List bounties error:", error);
      res.status(500).json({ message: "Failed to fetch bounties" });
    }
  });

  // Get single bounty with solutions
  app.get("/api/bounties/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const bounty = await storage.getBounty(id);
      if (!bounty) {
        return res.status(404).json({ message: "Bounty not found" });
      }

      const agent = await storage.getAgent(bounty.agentId);
      const solutions = await storage.getSolutionsByBounty(id);
      
      // Get agents for solutions
      const solutionAgentIds = [...new Set(solutions.map(s => s.agentId))];
      const solutionAgents = await storage.getAgentsByIds(solutionAgentIds);
      const agentMap = new Map(solutionAgents.map(a => [a.id, a]));
      
      const solutionsWithAgents = solutions.map(solution => ({
        ...solution,
        agent: agentMap.get(solution.agentId),
      }));

      const isExpired = new Date(bounty.deadline) < new Date() && bounty.status === "open";

      res.json({
        bounty: { ...bounty, agent, isExpired },
        solutions: solutionsWithAgents,
      });
    } catch (error) {
      console.error("Get bounty error:", error);
      res.status(500).json({ message: "Failed to fetch bounty" });
    }
  });

  // Submit solution
  app.post("/api/bounties/:bountyId/solutions", authMiddleware, async (req, res) => {
    try {
      const { bountyId } = req.params;
      const walletAddress = req.walletAddress!;

      // Validate request body
      const parseResult = submitSolutionRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const { agentId, body, attachments } = parseResult.data;

      // Verify bounty exists and is open
      const bounty = await storage.getBounty(bountyId);
      if (!bounty) {
        return res.status(404).json({ message: "Bounty not found" });
      }
      if (bounty.status !== "open") {
        return res.status(400).json({ message: "Bounty is no longer accepting solutions" });
      }
      if (new Date(bounty.deadline) < new Date()) {
        return res.status(400).json({ message: "Bounty deadline has passed" });
      }

      // Verify ownership
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.ownerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ message: "Not authorized to submit solution as this agent" });
      }

      // Check if already submitted
      const existingSolution = await storage.getSolutionByBountyAndAgent(bountyId, agentId);
      if (existingSolution) {
        return res.status(400).json({ message: "You have already submitted a solution to this bounty" });
      }

      // Cannot submit to own bounty
      if (bounty.agentId === agentId) {
        return res.status(400).json({ message: "Cannot submit a solution to your own bounty" });
      }

      const solution = await storage.createSolution({
        bountyId,
        agentId,
        body,
        attachments: attachments || [],
      });

      await storage.incrementBountySolutionCount(bountyId);

      res.status(201).json({ solution: { ...solution, agent } });
    } catch (error) {
      console.error("Submit solution error:", error);
      res.status(500).json({ message: "Failed to submit solution" });
    }
  });

  // Award solution
  app.post("/api/bounties/:bountyId/award", authMiddleware, async (req, res) => {
    try {
      const { bountyId } = req.params;
      const walletAddress = req.walletAddress!;

      // Validate request body
      const parseResult = awardSolutionRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const { solutionId } = parseResult.data;

      // Verify bounty exists
      const bounty = await storage.getBounty(bountyId);
      if (!bounty) {
        return res.status(404).json({ message: "Bounty not found" });
      }
      if (bounty.status !== "open") {
        return res.status(400).json({ message: "Bounty has already been awarded or cancelled" });
      }

      // Verify ownership - only bounty creator can award
      const agent = await storage.getAgent(bounty.agentId);
      if (!agent || agent.ownerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ message: "Only the bounty creator can award solutions" });
      }

      // Verify solution exists and belongs to this bounty
      const solution = await storage.getSolution(solutionId);
      if (!solution) {
        return res.status(404).json({ message: "Solution not found" });
      }
      if (solution.bountyId !== bountyId) {
        return res.status(400).json({ message: "Solution does not belong to this bounty" });
      }

      // Mark solution as winner and update bounty status
      await storage.markSolutionAsWinner(solutionId);
      const updatedBounty = await storage.updateBountyStatus(bountyId, "awarded", solutionId);

      // Get winner agent
      const winnerAgent = await storage.getAgent(solution.agentId);

      res.json({ 
        bounty: updatedBounty,
        winningSolution: { ...solution, agent: winnerAgent },
      });
    } catch (error) {
      console.error("Award solution error:", error);
      res.status(500).json({ message: "Failed to award solution" });
    }
  });

  // Cancel bounty
  app.post("/api/bounties/:bountyId/cancel", authMiddleware, async (req, res) => {
    try {
      const { bountyId } = req.params;
      const walletAddress = req.walletAddress!;

      // Verify bounty exists
      const bounty = await storage.getBounty(bountyId);
      if (!bounty) {
        return res.status(404).json({ message: "Bounty not found" });
      }
      if (bounty.status !== "open") {
        return res.status(400).json({ message: "Bounty has already been awarded or cancelled" });
      }

      // Verify ownership - only bounty creator can cancel
      const agent = await storage.getAgent(bounty.agentId);
      if (!agent || agent.ownerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ message: "Only the bounty creator can cancel the bounty" });
      }

      const updatedBounty = await storage.updateBountyStatus(bountyId, "cancelled");

      res.json({ bounty: updatedBounty });
    } catch (error) {
      console.error("Cancel bounty error:", error);
      res.status(500).json({ message: "Failed to cancel bounty" });
    }
  });

  // ========================================
  // LAUNCHPAD ENDPOINTS
  // ========================================

  // Store token metadata and return CID (simulated for now)
  app.post("/api/launch/storage/token-metadata", authMiddleware, async (req, res) => {
    try {
      const parseResult = tokenMetadataRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request", errors: parseResult.error.errors });
      }

      const { name, symbol, description, imageUrl, links, creatorBeeId } = parseResult.data;
      
      // In production, this would upload to IPFS and return a real CID
      // For now, create a deterministic mock CID from the content
      const content = JSON.stringify({ name, symbol, description, imageUrl, links, creatorBeeId });
      const mockCID = `Qm${Buffer.from(content).toString('base64').slice(0, 44).replace(/[+/=]/g, 'x')}`;

      res.json({ metadataCID: mockCID });
    } catch (error) {
      console.error("Token metadata storage error:", error);
      res.status(500).json({ message: "Failed to store token metadata" });
    }
  });

  // Get all launch tokens
  app.get("/api/launch/tokens", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const graduated = req.query.graduated === "true" ? true : req.query.graduated === "false" ? false : undefined;
      
      const tokens = await storage.getLaunchTokens(limit, graduated);
      res.json({ tokens });
    } catch (error) {
      console.error("Get launch tokens error:", error);
      res.status(500).json({ message: "Failed to get tokens" });
    }
  });

  // Admin: Clear all launch tokens (admin only)
  app.delete("/api/launch/tokens/clear-all", authMiddleware, async (req, res) => {
    try {
      const ADMIN_ADDRESS = "0xed72f8286e28d4f2aeb52d59385d1ff3bc9d81d7".toLowerCase();
      const userAddress = req.walletAddress?.toLowerCase();
      
      if (userAddress !== ADMIN_ADDRESS) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Clear all launch trades first (foreign key constraint)
      await db.delete(launchTrades);
      // Clear all launch tokens
      const result = await db.delete(launchTokens);
      
      res.json({ success: true, message: "All launch tokens cleared" });
    } catch (error) {
      console.error("Clear tokens error:", error);
      res.status(500).json({ message: "Failed to clear tokens" });
    }
  });

  // Get single token
  app.get("/api/launch/tokens/:address", async (req, res) => {
    try {
      const token = await storage.getLaunchToken(req.params.address);
      if (!token) {
        return res.status(404).json({ message: "Token not found" });
      }

      const trades = await storage.getLaunchTradesByToken(req.params.address, 50);
      res.json({ token, trades });
    } catch (error) {
      console.error("Get token error:", error);
      res.status(500).json({ message: "Failed to get token" });
    }
  });

  // Record a new token (called after on-chain creation event)
  app.post("/api/launch/tokens", authMiddleware, async (req, res) => {
    try {
      const { tokenAddress, name, symbol, metadataCID, description, imageUrl, creatorBeeId } = req.body;
      const walletAddress = req.walletAddress!;

      if (!tokenAddress || !name || !symbol || !metadataCID) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const token = await storage.createLaunchToken({
        tokenAddress,
        creatorAddress: walletAddress,
        creatorBeeId: creatorBeeId || null,
        name,
        symbol,
        metadataCID,
        description,
        imageUrl,
      });
      
      // Record launch activity
      const agent = await storage.getAgentByAddress(walletAddress);
      await storage.createLaunchActivity({
        type: 'launch',
        tokenAddress,
        tokenName: name,
        tokenSymbol: symbol,
        tokenImage: imageUrl || null,
        actorAddress: walletAddress,
        actorName: agent?.name || null,
        nativeAmount: null,
        tokenAmount: null,
        txHash: null,
      });

      res.json({ token });
    } catch (error) {
      console.error("Create token error:", error);
      res.status(500).json({ message: "Failed to record token" });
    }
  });

  // Record a trade (called after on-chain trade event)
  app.post("/api/launch/trades", async (req, res) => {
    try {
      const { tokenAddress, trader, isBuy, nativeAmount, tokenAmount, feeNative, priceAfter, txHash } = req.body;

      if (!tokenAddress || !trader || isBuy === undefined || !nativeAmount || !tokenAmount) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const trade = await storage.createLaunchTrade({
        tokenAddress,
        trader,
        isBuy,
        nativeAmount,
        tokenAmount,
        feeNative: feeNative || "0",
        priceAfter: priceAfter || "0",
        txHash,
      });

      // Get token info and update stats
      const token = await storage.getLaunchToken(tokenAddress);
      if (token) {
        // Update token stats
        if (isBuy) {
          const newTotalRaised = (BigInt(token.totalRaisedNative) + BigInt(nativeAmount) - BigInt(feeNative || "0")).toString();
          await storage.updateLaunchToken(tokenAddress, { 
            totalRaisedNative: newTotalRaised,
            lastTradeAt: new Date(),
          });
        }
        
        // Record activity
        const agent = await storage.getAgentByAddress(trader);
        await storage.createLaunchActivity({
          type: isBuy ? 'buy' : 'sell',
          tokenAddress,
          tokenName: token.name,
          tokenSymbol: token.symbol,
          tokenImage: token.imageUrl || null,
          actorAddress: trader,
          actorName: agent?.name || null,
          nativeAmount,
          tokenAmount,
          txHash,
        });
      }

      res.json({ trade });
    } catch (error) {
      console.error("Record trade error:", error);
      res.status(500).json({ message: "Failed to record trade" });
    }
  });
  
  // Get activity feed (recent trades, launches, migrations)
  app.get("/api/launch/activity", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const activity = await storage.getLaunchActivity(limit);
      res.json({ activity });
    } catch (error) {
      console.error("Get activity error:", error);
      res.status(500).json({ message: "Failed to get activity" });
    }
  });
  
  // Get trending tokens (King of the Hill)
  app.get("/api/launch/trending", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const tokens = await storage.getTrendingTokens(limit);
      res.json({ tokens });
    } catch (error) {
      console.error("Get trending error:", error);
      res.status(500).json({ message: "Failed to get trending tokens" });
    }
  });
  
  // Search tokens
  app.get("/api/launch/search", async (req, res) => {
    try {
      const query = req.query.q as string || "";
      const limit = parseInt(req.query.limit as string) || 20;
      
      if (!query.trim()) {
        return res.json({ tokens: [] });
      }
      
      const tokens = await storage.searchLaunchTokens(query, limit);
      res.json({ tokens });
    } catch (error) {
      console.error("Search tokens error:", error);
      res.status(500).json({ message: "Failed to search tokens" });
    }
  });
  
  // Get comments for a token
  app.get("/api/launch/tokens/:address/comments", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const comments = await storage.getLaunchComments(req.params.address, limit);
      res.json({ comments });
    } catch (error) {
      console.error("Get comments error:", error);
      res.status(500).json({ message: "Failed to get comments" });
    }
  });
  
  // Post a comment on a token
  app.post("/api/launch/tokens/:address/comments", authMiddleware, async (req, res) => {
    try {
      const { content } = req.body;
      const walletAddress = req.walletAddress!;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Content is required" });
      }
      
      if (content.length > 500) {
        return res.status(400).json({ message: "Comment too long (max 500 characters)" });
      }
      
      const agent = await storage.getAgentByAddress(walletAddress);
      
      const comment = await storage.createLaunchComment({
        tokenAddress: req.params.address,
        agentId: agent?.id || null,
        walletAddress,
        content: content.trim(),
      });
      
      res.json({ comment });
    } catch (error) {
      console.error("Post comment error:", error);
      res.status(500).json({ message: "Failed to post comment" });
    }
  });

  // Mark token as graduated
  app.post("/api/launch/tokens/:address/graduate", async (req, res) => {
    try {
      const token = await storage.updateLaunchToken(req.params.address, { graduated: true });
      res.json({ token });
    } catch (error) {
      console.error("Graduate token error:", error);
      res.status(500).json({ message: "Failed to graduate token" });
    }
  });

  // Record migration event
  app.post("/api/launch/tokens/:address/migrate", async (req, res) => {
    try {
      const { address } = req.params;
      const { pairAddress, lpAmount, lpLockAddress, txHash } = req.body;

      const token = await storage.updateLaunchToken(address, { 
        migrated: true,
        graduated: true,
        pairAddress: pairAddress?.toLowerCase(),
        lpAmount: lpAmount?.toString(),
        lpLockAddress: lpLockAddress?.toLowerCase(),
        migrationTxHash: txHash,
        migratedAt: new Date(),
      });

      res.json({ token });
    } catch (error) {
      console.error("Record migration error:", error);
      res.status(500).json({ message: "Failed to record migration" });
    }
  });

  // TX Preparation endpoints - return unsigned transaction data
  const TokenFactoryABI = [
    {
      name: "createToken",
      type: "function",
      inputs: [
        { name: "name", type: "string" },
        { name: "symbol", type: "string" },
        { name: "metadataCID", type: "string" },
        { name: "creatorBeeId", type: "uint256" }
      ],
      outputs: [{ name: "tokenAddress", type: "address" }]
    }
  ] as const;

  const BondingCurveMarketABI = [
    {
      name: "buy",
      type: "function",
      inputs: [
        { name: "token", type: "address" },
        { name: "minTokensOut", type: "uint256" }
      ],
      outputs: [{ name: "tokensOut", type: "uint256" }]
    },
    {
      name: "sell",
      type: "function",
      inputs: [
        { name: "token", type: "address" },
        { name: "tokenAmountIn", type: "uint256" },
        { name: "minNativeOut", type: "uint256" }
      ],
      outputs: [{ name: "nativeOut", type: "uint256" }]
    }
  ] as const;

  // Prepare create token transaction
  app.post("/api/tx/prepare/launch/create-token", authMiddleware, async (req, res) => {
    try {
      const parseResult = prepareCreateTokenRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request", errors: parseResult.error.errors });
      }

      const { creatorBeeId, metadataCID, name, symbol } = parseResult.data;
      const chainId = parseInt(req.query.chainId as string) || 97;

      // AI-Only Launch Enforcement: All token creation requires verified AI agent status
      // This matches competitive platforms like Clawnch where only verified AI agents can launch tokens
      const agent = await storage.getAgentByAddress(req.walletAddress!);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found. Please register first." });
      }

      const [verification] = await db.select()
        .from(aiAgentVerifications)
        .where(eq(aiAgentVerifications.agentId, agent.id))
        .limit(1);

      if (!verification?.isVerifiedAI || !verification?.canLaunchTokens) {
        return res.status(403).json({ 
          message: "Token launches require verified AI agent status with launch privileges. Request AI verification first.",
          verificationStatus: verification?.verificationType || "NONE",
          requirement: "AI_VERIFIED or FULL verification level with canLaunchTokens=true"
        });
      }

      // Get factory address for chain
      const factoryAddress = getContractAddress(chainId, "tokenFactory");
      if (!factoryAddress) {
        return res.status(400).json({ message: "Unsupported chain" });
      }

      const data = encodeFunctionData({
        abi: TokenFactoryABI,
        functionName: "createToken",
        args: [name, symbol, metadataCID, BigInt(creatorBeeId || "0")]
      });

      res.json({
        to: factoryAddress,
        data,
        value: "0",
        chainId
      });
    } catch (error) {
      console.error("Prepare create token error:", error);
      res.status(500).json({ message: "Failed to prepare transaction" });
    }
  });

  // Prepare buy transaction
  app.post("/api/tx/prepare/launch/buy", authMiddleware, async (req, res) => {
    try {
      const parseResult = prepareBuyRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request", errors: parseResult.error.errors });
      }

      const { token, nativeValueWei, minTokensOut } = parseResult.data;
      const chainId = parseInt(req.query.chainId as string) || 97;

      const marketAddress = getContractAddress(chainId, "bondingCurveMarket");
      if (!marketAddress) {
        return res.status(400).json({ message: "Unsupported chain" });
      }

      const data = encodeFunctionData({
        abi: BondingCurveMarketABI,
        functionName: "buy",
        args: [token as `0x${string}`, BigInt(minTokensOut)]
      });

      res.json({
        to: marketAddress,
        data,
        value: nativeValueWei,
        chainId
      });
    } catch (error) {
      console.error("Prepare buy error:", error);
      res.status(500).json({ message: "Failed to prepare transaction" });
    }
  });

  // Prepare sell transaction
  app.post("/api/tx/prepare/launch/sell", authMiddleware, async (req, res) => {
    try {
      const parseResult = prepareSellRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request", errors: parseResult.error.errors });
      }

      const { token, tokenAmountIn, minNativeOut } = parseResult.data;
      const chainId = parseInt(req.query.chainId as string) || 97;

      const marketAddress = getContractAddress(chainId, "bondingCurveMarket");
      if (!marketAddress) {
        return res.status(400).json({ message: "Unsupported chain" });
      }

      const data = encodeFunctionData({
        abi: BondingCurveMarketABI,
        functionName: "sell",
        args: [token as `0x${string}`, BigInt(tokenAmountIn), BigInt(minNativeOut)]
      });

      res.json({
        to: marketAddress,
        data,
        value: "0",
        chainId
      });
    } catch (error) {
      console.error("Prepare sell error:", error);
      res.status(500).json({ message: "Failed to prepare transaction" });
    }
  });

  // Migration ABI
  const MigrationABI = [
    {
      name: "migrate",
      type: "function",
      inputs: [{ name: "token", type: "address" }],
      outputs: []
    }
  ] as const;

  // Prepare migrate transaction
  app.post("/api/tx/prepare/launch/migrate", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "Token address required" });
      }

      const chainId = parseInt(req.query.chainId as string) || 97;

      const migrationAddress = getContractAddress(chainId, "migration");
      if (!migrationAddress || migrationAddress === "0x0000000000000000000000000000000000000000") {
        return res.status(400).json({ message: "Migration not supported on this chain" });
      }

      const data = encodeFunctionData({
        abi: MigrationABI,
        functionName: "migrate",
        args: [token as `0x${string}`]
      });

      res.json({
        to: migrationAddress,
        data,
        value: "0",
        chainId
      });
    } catch (error) {
      console.error("Prepare migrate error:", error);
      res.status(500).json({ message: "Failed to prepare transaction" });
    }
  });

  // Helper function to get contract addresses
  function getContractAddress(chainId: number, contract: string): string | null {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    
    const addresses: Record<number, Record<string, string>> = {
      31337: {
        agentRegistry: ZERO_ADDRESS,
        bountyEscrow: ZERO_ADDRESS,
        postBond: ZERO_ADDRESS,
        reputation: ZERO_ADDRESS,
        feeVault: ZERO_ADDRESS,
        tokenFactory: ZERO_ADDRESS,
        bondingCurveMarket: ZERO_ADDRESS,
        migration: ZERO_ADDRESS,
      },
      97: {
        agentRegistry: ZERO_ADDRESS,
        bountyEscrow: ZERO_ADDRESS,
        postBond: ZERO_ADDRESS,
        reputation: ZERO_ADDRESS,
        feeVault: ZERO_ADDRESS,
        tokenFactory: ZERO_ADDRESS,
        bondingCurveMarket: ZERO_ADDRESS,
        migration: ZERO_ADDRESS,
      },
      56: {
        agentRegistry: ZERO_ADDRESS,
        bountyEscrow: ZERO_ADDRESS,
        postBond: ZERO_ADDRESS,
        reputation: ZERO_ADDRESS,
        feeVault: ZERO_ADDRESS,
        tokenFactory: ZERO_ADDRESS,
        bondingCurveMarket: ZERO_ADDRESS,
        migration: ZERO_ADDRESS,
      },
      5611: {
        agentRegistry: ZERO_ADDRESS,
        bountyEscrow: ZERO_ADDRESS,
        postBond: ZERO_ADDRESS,
        reputation: ZERO_ADDRESS,
        feeVault: ZERO_ADDRESS,
        tokenFactory: ZERO_ADDRESS,
        bondingCurveMarket: ZERO_ADDRESS,
        migration: ZERO_ADDRESS,
      },
      204: {
        agentRegistry: ZERO_ADDRESS,
        bountyEscrow: ZERO_ADDRESS,
        postBond: ZERO_ADDRESS,
        reputation: ZERO_ADDRESS,
        feeVault: ZERO_ADDRESS,
        tokenFactory: ZERO_ADDRESS,
        bondingCurveMarket: ZERO_ADDRESS,
        migration: ZERO_ADDRESS,
      },
      // Base Mainnet
      8453: {
        agentRegistry: ZERO_ADDRESS,
        bountyEscrow: ZERO_ADDRESS,
        postBond: ZERO_ADDRESS,
        reputation: ZERO_ADDRESS,
        feeVault: ZERO_ADDRESS,
        tokenFactory: ZERO_ADDRESS,
        bondingCurveMarket: ZERO_ADDRESS,
        migration: ZERO_ADDRESS,
      },
      // Base Sepolia Testnet
      84532: {
        agentRegistry: ZERO_ADDRESS,
        bountyEscrow: ZERO_ADDRESS,
        postBond: ZERO_ADDRESS,
        reputation: ZERO_ADDRESS,
        feeVault: ZERO_ADDRESS,
        tokenFactory: ZERO_ADDRESS,
        bondingCurveMarket: ZERO_ADDRESS,
        migration: ZERO_ADDRESS,
      },
    };

    return addresses[chainId]?.[contract] || null;
  }

  // Contract configuration endpoint
  // Returns contract addresses for the requested chain
  app.get("/api/contracts/:chainId", (req, res) => {
    const chainId = parseInt(req.params.chainId);
    
    const addresses = {
      agentRegistry: getContractAddress(chainId, "agentRegistry"),
      bountyEscrow: getContractAddress(chainId, "bountyEscrow"),
      postBond: getContractAddress(chainId, "postBond"),
      reputation: getContractAddress(chainId, "reputation"),
      feeVault: getContractAddress(chainId, "feeVault"),
      tokenFactory: getContractAddress(chainId, "tokenFactory"),
      bondingCurveMarket: getContractAddress(chainId, "bondingCurveMarket"),
    };

    if (!addresses.agentRegistry) {
      return res.status(404).json({ 
        message: "Unsupported chain ID", 
        supportedChains: [31337, 97, 56, 5611, 204, 8453, 84532]
      });
    }

    res.json({ chainId, addresses });
  });

  // Register Hive feature routes (channels, bot follows, memory, webhooks, skills, verification)
  registerHiveRoutes(app);

  // Register AI chat routes
  registerChatRoutes(app);

  // Register paid AI agent marketplace routes
  registerAiAgentRoutes(app);
  
  registerDuelsRoutes(app);

  // Register Twitter automation routes
  registerTwitterRoutes(app);

  // Register autonomous AI agent routes
  registerAutonomousAgentRoutes(app);

  // Register BeePay settlement layer routes
  app.use("/api/beepay", beepayRoutes);

  // Register BAP-578 NFA (Non-Fungible Agent) routes
  app.use("/api/nfa", nfaRouter);

  // Admin endpoint to set cooldown to 0 (requires DEPLOYER_PRIVATE_KEY)
  app.post("/api/admin/set-cooldown", async (req, res) => {
    try {
      const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
      if (!privateKey) {
        return res.status(500).json({ message: "Deployer private key not configured" });
      }

      const cooldownSeconds = req.body.cooldownSeconds ?? 0;
      const marketAddress = "0x960518eC278b5a78bD1B5fC1b2E22abC5DB1A167" as `0x${string}`;

      const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey as `0x${string}` : `0x${privateKey}`);
      
      const walletClient = createWalletClient({
        account,
        chain: bsc,
        transport: http("https://bsc-dataseed1.binance.org"),
      });

      const setCooldownAbi = [{
        type: "function",
        name: "setCooldownSeconds",
        inputs: [{ name: "_cooldown", type: "uint256" }],
        outputs: [],
        stateMutability: "nonpayable",
      }] as const;

      const hash = await walletClient.writeContract({
        address: marketAddress,
        abi: setCooldownAbi,
        functionName: "setCooldownSeconds",
        args: [BigInt(cooldownSeconds)],
      });

      res.json({ success: true, hash, cooldownSeconds });
    } catch (error: any) {
      console.error("Failed to set cooldown:", error);
      res.status(500).json({ message: error.message || "Failed to set cooldown" });
    }
  });

  // Public landing page stats (no auth required)
  app.get("/api/landing-stats", async (req, res) => {
    try {
      const usersResult = await db.execute(sql`SELECT COUNT(*) as count FROM agents`);
      const nfasResult = await db.execute(sql`SELECT COUNT(*) as count FROM nfa_agents`);
      const volumeResult = await db.execute(sql`SELECT COALESCE(SUM(CAST(price_wei AS DECIMAL) / 1e18), 0) as volume FROM nfa_listings WHERE active = false`);
      
      const users = (usersResult as any).rows?.[0]?.count || (usersResult as any)[0]?.count || 0;
      const nfas = (nfasResult as any).rows?.[0]?.count || (nfasResult as any)[0]?.count || 0;
      const volume = (volumeResult as any).rows?.[0]?.volume || (volumeResult as any)[0]?.volume || "0";
      
      res.json({
        totalUsers: Number(users),
        totalNfas: Number(nfas),
        totalVolume: parseFloat(volume).toFixed(2),
      });
    } catch (error: any) {
      console.error("Failed to get landing stats:", error);
      res.json({ totalUsers: 0, totalNfas: 0, totalVolume: "0" });
    }
  });

  // Platform stats endpoint (admin only)
  const ADMIN_ADDRESS = "0xed72f8286e28d4f2aeb52d59385d1ff3bc9d81d7".toLowerCase();
  app.get("/api/stats", authMiddleware, async (req, res) => {
    try {
      const userAddress = req.walletAddress?.toLowerCase();
      if (userAddress !== ADMIN_ADDRESS) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      const stats = await storage.getPlatformStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Failed to get platform stats:", error);
      res.status(500).json({ message: error.message || "Failed to get stats" });
    }
  });

  // ============ GROWTH & GAMIFICATION ============

  // Get or create referral link for current user
  app.get("/api/referrals/my-link", authMiddleware, async (req, res) => {
    try {
      const agent = await storage.getAgentByAddress(req.walletAddress!);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      let referral = await storage.getReferralByAgent(agent.id);
      if (!referral) {
        const code = `BEE${agent.id.slice(0, 8).toUpperCase()}`;
        referral = await storage.createReferral({
          referrerAgentId: agent.id,
          referralCode: code,
        });
      }

      res.json(referral);
    } catch (error: any) {
      console.error("Failed to get referral link:", error);
      res.status(500).json({ message: error.message || "Failed to get referral link" });
    }
  });

  // Get referral stats for current user
  app.get("/api/referrals/stats", authMiddleware, async (req, res) => {
    try {
      const agent = await storage.getAgentByAddress(req.walletAddress!);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const referral = await storage.getReferralByAgent(agent.id);
      if (!referral) {
        return res.json({ referralCount: 0, tier: "newcomer", conversions: [] });
      }

      const conversions = await storage.getReferralConversions(referral.id);
      res.json({
        ...referral,
        conversions,
      });
    } catch (error: any) {
      console.error("Failed to get referral stats:", error);
      res.status(500).json({ message: error.message || "Failed to get referral stats" });
    }
  });

  // Process referral on signup
  app.post("/api/referrals/apply", authMiddleware, async (req, res) => {
    try {
      const { referralCode } = req.body;
      if (!referralCode) {
        return res.status(400).json({ message: "Referral code required" });
      }

      const agent = await storage.getAgentByAddress(req.walletAddress!);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const alreadyReferred = await storage.isAlreadyReferred(agent.id);
      if (alreadyReferred) {
        return res.status(400).json({ message: "Already used a referral code" });
      }

      const referral = await storage.getReferralByCode(referralCode.toUpperCase());
      if (!referral) {
        return res.status(404).json({ message: "Invalid referral code" });
      }

      if (referral.referrerAgentId === agent.id) {
        return res.status(400).json({ message: "Cannot refer yourself" });
      }

      await storage.createReferralConversion({
        referralId: referral.id,
        referredAgentId: agent.id,
        rewardAmount: "0",
      });

      const updated = await storage.incrementReferralCount(referral.id);

      let newTier = "newcomer";
      if (updated.referralCount >= 500) newTier = "queen";
      else if (updated.referralCount >= 100) newTier = "gold";
      else if (updated.referralCount >= 25) newTier = "silver";
      else if (updated.referralCount >= 5) newTier = "bronze";

      if (newTier !== updated.tier) {
        await storage.updateReferralTier(referral.id, newTier);
      }

      // Award referral points to both parties
      const referralMadeConfig = await storage.getPointsConfig("referral_made");
      if (referralMadeConfig?.isActive) {
        await storage.addPoints(referral.referrerAgentId, "referral_made", referralMadeConfig.basePoints, referral.id, "referral");
      }
      const referralReceivedConfig = await storage.getPointsConfig("referral_received");
      if (referralReceivedConfig?.isActive) {
        await storage.addPoints(agent.id, "referral_received", referralReceivedConfig.basePoints, referral.id, "referral");
      }

      res.json({ success: true, message: "Referral applied successfully" });
    } catch (error: any) {
      console.error("Failed to apply referral:", error);
      res.status(500).json({ message: error.message || "Failed to apply referral" });
    }
  });

  // Get top referrers leaderboard
  app.get("/api/leaderboards/referrers", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const referrers = await storage.getTopReferrers(limit);

      const enriched = await Promise.all(referrers.map(async (r) => {
        const agent = await storage.getAgent(r.referrerAgentId);
        return {
          ...r,
          agent: agent ? { id: agent.id, name: agent.name, avatarUrl: agent.avatarUrl } : null,
        };
      }));

      res.json({ leaderboard: enriched });
    } catch (error: any) {
      console.error("Failed to get referrer leaderboard:", error);
      res.status(500).json({ message: error.message || "Failed to get leaderboard" });
    }
  });

  // Get all achievements
  app.get("/api/achievements", async (req, res) => {
    try {
      const achievements = await storage.getAchievementDefs();
      res.json({ achievements });
    } catch (error: any) {
      console.error("Failed to get achievements:", error);
      res.status(500).json({ message: error.message || "Failed to get achievements" });
    }
  });

  // Get user's achievements
  app.get("/api/achievements/my", authMiddleware, async (req, res) => {
    try {
      const agent = await storage.getAgentByAddress(req.walletAddress!);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const userAchievements = await storage.getUserAchievements(agent.id);
      const allAchievements = await storage.getAchievementDefs();

      const merged = allAchievements.map((def) => {
        const userProgress = userAchievements.find((ua) => ua.achievementId === def.id);
        return {
          ...def,
          progress: userProgress?.progress || 0,
          completed: userProgress?.completed || false,
          completedAt: userProgress?.completedAt,
        };
      });

      res.json({ achievements: merged });
    } catch (error: any) {
      console.error("Failed to get user achievements:", error);
      res.status(500).json({ message: error.message || "Failed to get user achievements" });
    }
  });

  // Get early adopter status
  app.get("/api/early-adopter", authMiddleware, async (req, res) => {
    try {
      const agent = await storage.getAgentByAddress(req.walletAddress!);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const earlyAdopter = await storage.getEarlyAdopter(agent.id);
      const totalCount = await storage.getEarlyAdopterCount();

      res.json({
        isEarlyAdopter: !!earlyAdopter,
        badgeNumber: earlyAdopter?.badgeNumber,
        rewardMultiplier: earlyAdopter?.rewardMultiplier,
        totalEarlyAdopters: totalCount,
        maxEarlyAdopters: 10000,
      });
    } catch (error: any) {
      console.error("Failed to get early adopter status:", error);
      res.status(500).json({ message: error.message || "Failed to get early adopter status" });
    }
  });

  // Get combined growth leaderboards
  app.get("/api/leaderboards", async (req, res) => {
    try {
      const referrers = await storage.getTopReferrers(10);
      const enrichedReferrers = await Promise.all(referrers.map(async (r) => {
        const agent = await storage.getAgent(r.referrerAgentId);
        return {
          ...r,
          agent: agent ? { id: agent.id, name: agent.name, avatarUrl: agent.avatarUrl } : null,
        };
      }));

      res.json({
        topReferrers: enrichedReferrers,
      });
    } catch (error: any) {
      console.error("Failed to get leaderboards:", error);
      res.status(500).json({ message: error.message || "Failed to get leaderboards" });
    }
  });

  // Seed default achievements (admin only)
  app.post("/api/admin/seed-achievements", authMiddleware, async (req, res) => {
    try {
      const userAddress = req.walletAddress?.toLowerCase();
      if (userAddress !== ADMIN_ADDRESS) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const defaultAchievements = [
        { slug: "first_post", name: "First Buzz", nameZh: "首次发帖", description: "Create your first post", descriptionZh: "发布你的第一篇帖子", icon: "FileText", category: "social", requirement: 1 },
        { slug: "first_comment", name: "First Reply", nameZh: "首次评论", description: "Leave your first comment", descriptionZh: "发表你的第一条评论", icon: "MessageSquare", category: "social", requirement: 1 },
        { slug: "first_bounty", name: "Bounty Hunter", nameZh: "赏金猎人", description: "Complete your first bounty", descriptionZh: "完成你的第一个赏金任务", icon: "Coins", category: "bounty", requirement: 1 },
        { slug: "first_referral", name: "Hive Builder", nameZh: "蜂巢建设者", description: "Refer your first friend", descriptionZh: "邀请你的第一位朋友", icon: "Users", category: "referral", requirement: 1 },
        { slug: "bronze_referrer", name: "Bronze Bee", nameZh: "青铜蜜蜂", description: "Refer 5 friends", descriptionZh: "邀请5位朋友", icon: "Award", category: "referral", requirement: 5 },
        { slug: "silver_referrer", name: "Silver Bee", nameZh: "白银蜜蜂", description: "Refer 25 friends", descriptionZh: "邀请25位朋友", icon: "Award", category: "referral", requirement: 25 },
        { slug: "gold_referrer", name: "Gold Bee", nameZh: "黄金蜜蜂", description: "Refer 100 friends", descriptionZh: "邀请100位朋友", icon: "Award", category: "referral", requirement: 100 },
        { slug: "queen_referrer", name: "Queen Bee", nameZh: "蜂后", description: "Refer 500 friends", descriptionZh: "邀请500位朋友", icon: "Crown", category: "referral", requirement: 500 },
        { slug: "create_agent", name: "Agent Creator", nameZh: "代理创建者", description: "Create your first AI agent", descriptionZh: "创建你的第一个AI代理", icon: "Bot", category: "agent", requirement: 1 },
        { slug: "early_adopter", name: "Early Adopter", nameZh: "早期采用者", description: "One of the first 10,000 Bees", descriptionZh: "前10,000名蜜蜂之一", icon: "Star", category: "special", requirement: 1 },
      ];

      for (const achievement of defaultAchievements) {
        const existing = await storage.getAchievementBySlug(achievement.slug);
        if (!existing) {
          await storage.createAchievementDef(achievement);
        }
      }

      res.json({ success: true, message: "Achievements seeded" });
    } catch (error: any) {
      console.error("Failed to seed achievements:", error);
      res.status(500).json({ message: error.message || "Failed to seed achievements" });
    }
  });

  // === Points System Routes ===

  // Get user's points
  app.get("/api/points/my", authMiddleware, async (req, res) => {
    try {
      const agent = await storage.getAgentByAddress(req.walletAddress!);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      let points = await storage.getUserPoints(agent.id);
      if (!points) {
        points = await storage.createUserPoints(agent.id);
      }

      res.json({ points });
    } catch (error: any) {
      console.error("Failed to get points:", error);
      res.status(500).json({ message: error.message || "Failed to get points" });
    }
  });

  // Get user's points history
  app.get("/api/points/history", authMiddleware, async (req, res) => {
    try {
      const agent = await storage.getAgentByAddress(req.walletAddress!);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const history = await storage.getPointsHistory(agent.id, limit);

      res.json({ history });
    } catch (error: any) {
      console.error("Failed to get points history:", error);
      res.status(500).json({ message: error.message || "Failed to get points history" });
    }
  });

  // Get points leaderboard
  app.get("/api/points/leaderboard", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const pointsLeaderboard = await storage.getPointsLeaderboard(limit);

      // Enrich with agent info
      const agentIds = pointsLeaderboard.map(p => p.agentId);
      const agents = await storage.getAgentsByIds(agentIds);
      const agentMap = new Map(agents.map(a => [a.id, a]));

      const leaderboard = pointsLeaderboard.map((p, index) => {
        const agent = agentMap.get(p.agentId);
        return {
          rank: index + 1,
          agentId: p.agentId,
          name: agent?.name || "Unknown Bee",
          avatarUrl: agent?.avatarUrl,
          totalPoints: p.totalPoints,
          lifetimePoints: p.lifetimePoints,
        };
      });

      res.json({ leaderboard });
    } catch (error: any) {
      console.error("Failed to get points leaderboard:", error);
      res.status(500).json({ message: error.message || "Failed to get points leaderboard" });
    }
  });

  // Get points config (public - shows what actions earn points)
  app.get("/api/points/config", async (_req, res) => {
    try {
      const configs = await storage.getAllPointsConfig();
      res.json({ configs });
    } catch (error: any) {
      console.error("Failed to get points config:", error);
      res.status(500).json({ message: error.message || "Failed to get points config" });
    }
  });

  // Seed default points config (admin only)
  app.post("/api/admin/seed-points-config", authMiddleware, async (req, res) => {
    try {
      const userAddress = req.walletAddress?.toLowerCase();
      if (userAddress !== ADMIN_ADDRESS) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const defaultConfigs = [
        { action: "registration", basePoints: 100, dailyCap: null, description: "Account registration bonus", isActive: true },
        { action: "referral_made", basePoints: 50, dailyCap: null, description: "Successfully referred a new user", isActive: true },
        { action: "referral_received", basePoints: 25, dailyCap: null, description: "Joined via referral link", isActive: true },
        { action: "post", basePoints: 10, dailyCap: 100, description: "Create a new post", isActive: true },
        { action: "comment", basePoints: 5, dailyCap: 50, description: "Leave a comment", isActive: true },
        { action: "bounty_complete", basePoints: 50, dailyCap: null, description: "Complete a bounty", isActive: true },
        { action: "daily_login", basePoints: 5, dailyCap: 5, description: "Daily login bonus", isActive: true },
        { action: "achievement", basePoints: 25, dailyCap: null, description: "Unlock an achievement", isActive: true },
        { action: "create_agent", basePoints: 100, dailyCap: null, description: "Create an AI agent", isActive: true },
        { action: "launch_token", basePoints: 200, dailyCap: null, description: "Launch a token in The Hatchery", isActive: true },
      ];

      for (const config of defaultConfigs) {
        await storage.upsertPointsConfig(config);
      }

      res.json({ success: true, message: "Points config seeded" });
    } catch (error: any) {
      console.error("Failed to seed points config:", error);
      res.status(500).json({ message: error.message || "Failed to seed points config" });
    }
  });

  // ============ COMPETITIVE FEATURES ============
  // Import services
  const { heartbeatService } = await import("./heartbeat-service");
  const { launchAlertService } = await import("./launch-alert-service");

  // Start background services
  heartbeatService.start();
  launchAlertService.start();

  // --- Agent Heartbeat Routes ---
  
  // Get heartbeat status for an agent
  app.get("/api/heartbeat/:agentId", authMiddleware, async (req, res) => {
    try {
      const { agentId } = req.params;
      const status = await heartbeatService.getHeartbeatStatus(agentId);
      res.json({ heartbeat: status });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get heartbeat status" });
    }
  });

  // Enable heartbeat for an agent
  app.post("/api/heartbeat/enable", authMiddleware, async (req, res) => {
    try {
      const parseResult = enableHeartbeatRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request", errors: parseResult.error.errors });
      }

      const agent = await storage.getAgentByAddress(req.walletAddress!);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      if (!agent.isBot) {
        return res.status(400).json({ message: "Heartbeat is only available for bot accounts" });
      }

      const { intervalMinutes, maxDailyPosts, topics, personality, targetChannelId, postTemplate } = parseResult.data;
      
      await heartbeatService.enableHeartbeat(agent.id, {
        intervalMinutes,
        maxDailyPosts,
        topics,
        personality,
        targetChannelId,
        postTemplate,
      });

      res.json({ success: true, message: "Heartbeat enabled" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to enable heartbeat" });
    }
  });

  // Disable heartbeat for an agent
  app.post("/api/heartbeat/disable", authMiddleware, async (req, res) => {
    try {
      const agent = await storage.getAgentByAddress(req.walletAddress!);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      await heartbeatService.disableHeartbeat(agent.id);
      res.json({ success: true, message: "Heartbeat disabled" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to disable heartbeat" });
    }
  });

  // Get heartbeat logs
  app.get("/api/heartbeat/:agentId/logs", authMiddleware, async (req, res) => {
    try {
      const { agentId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const logs = await heartbeatService.getHeartbeatLogs(agentId, limit);
      res.json({ logs });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get heartbeat logs" });
    }
  });

  // Bot API: Enable heartbeat via API key
  app.post("/api/bot/heartbeat/enable", botAuthMiddleware, async (req, res) => {
    try {
      const parseResult = enableHeartbeatRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request", errors: parseResult.error.errors });
      }

      const agent = req.bot;
      if (!agent) {
        return res.status(404).json({ message: "Bot not found" });
      }

      const { intervalMinutes, maxDailyPosts, topics, personality, targetChannelId, postTemplate } = parseResult.data;
      
      await heartbeatService.enableHeartbeat(agent.id, {
        intervalMinutes,
        maxDailyPosts,
        topics,
        personality,
        targetChannelId,
        postTemplate,
      });

      res.json({ success: true, message: "Heartbeat enabled" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to enable heartbeat" });
    }
  });

  // Bot API: Disable heartbeat via API key
  app.post("/api/bot/heartbeat/disable", botAuthMiddleware, async (req, res) => {
    try {
      const agent = req.bot;
      if (!agent) {
        return res.status(404).json({ message: "Bot not found" });
      }

      await heartbeatService.disableHeartbeat(agent.id);
      res.json({ success: true, message: "Heartbeat disabled" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to disable heartbeat" });
    }
  });

  // --- Launch Alerts Routes ---

  // Get launch alert config (admin only)
  app.get("/api/launch-alerts/config", authMiddleware, async (req, res) => {
    try {
      const userAddress = req.walletAddress?.toLowerCase();
      if (userAddress !== ADMIN_ADDRESS) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const config = await launchAlertService.getConfig();
      res.json({ config });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get alert config" });
    }
  });

  // Update launch alert config (admin only)
  app.patch("/api/launch-alerts/config", authMiddleware, async (req, res) => {
    try {
      const parseResult = updateLaunchAlertConfigSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request", errors: parseResult.error.errors });
      }

      const userAddress = req.walletAddress?.toLowerCase();
      if (userAddress !== ADMIN_ADDRESS) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await launchAlertService.updateConfig(parseResult.data);
      res.json({ success: true, message: "Alert config updated" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update alert config" });
    }
  });

  // Get recent launch alerts (public - for transparency)
  app.get("/api/launch-alerts", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const alerts = await launchAlertService.getRecentAlerts(limit);
      res.json({ alerts });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get alerts" });
    }
  });

  // --- Multi-Chain Routes ---

  // Get supported chains
  app.get("/api/chains", async (_req, res) => {
    try {
      const chains = await db.select().from(supportedChains).where(eq(supportedChains.isActive, true));
      res.json({ chains });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get chains" });
    }
  });

  // Get cross-chain deployments for an agent
  app.get("/api/agents/:agentId/chains", async (req, res) => {
    try {
      const { agentId } = req.params;
      const deployments = await db.select()
        .from(crossChainAgents)
        .where(eq(crossChainAgents.agentId, agentId));
      res.json({ deployments });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get chain deployments" });
    }
  });

  // --- AI Verification Routes ---

  // Get AI verification status for an agent
  app.get("/api/agents/:agentId/ai-verification", async (req, res) => {
    try {
      const { agentId } = req.params;
      const [verification] = await db.select()
        .from(aiAgentVerifications)
        .where(eq(aiAgentVerifications.agentId, agentId))
        .limit(1);
      res.json({ verification: verification || null });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get verification" });
    }
  });

  // Request AI verification (for bots)
  app.post("/api/agents/request-ai-verification", authMiddleware, async (req, res) => {
    try {
      const agent = await storage.getAgentByAddress(req.walletAddress!);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      if (!agent.isBot || !agent.apiKey) {
        return res.status(400).json({ message: "AI verification requires bot mode with API key" });
      }

      const [existing] = await db.select()
        .from(aiAgentVerifications)
        .where(eq(aiAgentVerifications.agentId, agent.id))
        .limit(1);

      if (existing) {
        return res.json({ verification: existing, message: "Verification already exists" });
      }

      const [verification] = await db.insert(aiAgentVerifications).values({
        agentId: agent.id,
        verificationType: "BASIC",
        isVerifiedAI: true,
        verificationMethod: "api_key",
        canAutoPost: true,
        canLaunchTokens: false,
        verifiedAt: new Date(),
      }).returning();

      res.json({ verification, message: "AI verification granted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to request verification" });
    }
  });

  // Admin: Grant full AI verification
  app.post("/api/admin/grant-ai-verification", authMiddleware, async (req, res) => {
    try {
      const userAddress = req.walletAddress?.toLowerCase();
      if (userAddress !== ADMIN_ADDRESS) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { agentId, canLaunchTokens, canAutoPost, badge } = req.body;

      const [existing] = await db.select()
        .from(aiAgentVerifications)
        .where(eq(aiAgentVerifications.agentId, agentId))
        .limit(1);

      if (existing) {
        await db.update(aiAgentVerifications)
          .set({
            verificationType: "FULL",
            isVerifiedAI: true,
            verificationMethod: "manual",
            verifiedBy: userAddress,
            verifiedAt: new Date(),
            canLaunchTokens: canLaunchTokens ?? true,
            canAutoPost: canAutoPost ?? true,
            badge: badge || "Verified AI Agent",
            updatedAt: new Date(),
          })
          .where(eq(aiAgentVerifications.agentId, agentId));
      } else {
        await db.insert(aiAgentVerifications).values({
          agentId,
          verificationType: "FULL",
          isVerifiedAI: true,
          verificationMethod: "manual",
          verifiedBy: userAddress,
          verifiedAt: new Date(),
          canLaunchTokens: canLaunchTokens ?? true,
          canAutoPost: canAutoPost ?? true,
          badge: badge || "Verified AI Agent",
        });
      }

      res.json({ success: true, message: "AI verification granted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to grant verification" });
    }
  });

  // Post announcement thread to Twitter (admin only)
  app.post("/api/admin/twitter/post-announcement", authMiddleware, async (req, res) => {
    try {
      const userAddress = req.walletAddress?.toLowerCase();
      if (userAddress !== ADMIN_ADDRESS) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { tweets } = req.body;
      if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
        return res.status(400).json({ message: "tweets array is required" });
      }

      const { TwitterService } = await import("./twitter-service");
      const twitterService = new TwitterService();

      if (!twitterService.isConfigured()) {
        return res.status(500).json({ message: "Twitter API not configured" });
      }

      const result = await twitterService.postThread(tweets, true);

      if (result.success) {
        res.json({ 
          success: true, 
          message: `Thread posted successfully with ${result.tweetIds?.length} tweets`,
          tweetIds: result.tweetIds,
          threadUrl: `https://twitter.com/honeycombchain/status/${result.tweetIds?.[0]}`
        });
      } else {
        res.status(500).json({ message: result.error || "Failed to post thread" });
      }
    } catch (error: any) {
      console.error("Post announcement error:", error);
      res.status(500).json({ message: error.message || "Failed to post announcement" });
    }
  });

  return httpServer;
}
