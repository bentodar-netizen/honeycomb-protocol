import { Router, Request, Response, NextFunction } from "express";
import { twitterService } from "./twitter-service";
import { z } from "zod";
import { authMiddleware } from "./auth";

const router = Router();

const ADMIN_ADDRESS = "0xed72f8286e28d4f2aeb52d59385d1ff3bc9d81d7".toLowerCase();

function adminOnly(req: Request, res: Response, next: NextFunction) {
  const userAddress = req.walletAddress?.toLowerCase();
  if (userAddress !== ADMIN_ADDRESS) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

const updateConfigSchema = z.object({
  isActive: z.boolean().optional(),
  tweetIntervalMinutes: z.number().min(15).max(1440).optional(),
  dailyTweetLimit: z.number().min(1).max(100).optional(),
  systemPrompt: z.string().min(10).optional(),
  personality: z.enum(["professional", "casual", "hype", "educational"]).optional(),
  tweetTopics: z.array(z.string()).max(20).optional(),
});

const generateTweetSchema = z.object({
  topic: z.string().max(100).optional(),
  style: z.enum(["professional", "casual", "hype", "educational"]).optional(),
});

router.get("/status", authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const isConfigured = twitterService.isConfigured();
    const botAgent = await twitterService.getTwitterBotAgent();
    
    let config = null;
    let recentTweets: any[] = [];
    
    if (botAgent) {
      config = await twitterService.getBotConfig(botAgent.id);
      recentTweets = await twitterService.getRecentTweets(botAgent.id, 10);
    }

    res.json({
      twitterApiConfigured: isConfigured,
      botAgent,
      config: config ? {
        isActive: config.isActive,
        tweetIntervalMinutes: config.tweetIntervalMinutes,
        dailyTweetLimit: config.dailyTweetLimit,
        todayTweetCount: config.todayTweetCount,
        lastTweetAt: config.lastTweetAt,
        personality: config.personality,
        tweetTopics: config.tweetTopics,
      } : null,
      recentTweets,
    });
  } catch (error: any) {
    console.error("Error getting Twitter status:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/setup", authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const agentId = await twitterService.createTwitterBotAgent();
    const config = await twitterService.createOrUpdateBotConfig(agentId, {});
    
    res.json({
      success: true,
      agentId,
      config: {
        isActive: config.isActive,
        tweetIntervalMinutes: config.tweetIntervalMinutes,
        dailyTweetLimit: config.dailyTweetLimit,
        personality: config.personality,
      },
    });
  } catch (error: any) {
    console.error("Error setting up Twitter bot:", error);
    res.status(500).json({ error: error.message });
  }
});

router.patch("/config", authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const botAgent = await twitterService.getTwitterBotAgent();
    if (!botAgent) {
      return res.status(404).json({ error: "Twitter bot not set up. Call /setup first." });
    }

    const parsed = updateConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }

    const config = await twitterService.createOrUpdateBotConfig(botAgent.id, parsed.data);
    
    res.json({
      success: true,
      config: {
        isActive: config.isActive,
        tweetIntervalMinutes: config.tweetIntervalMinutes,
        dailyTweetLimit: config.dailyTweetLimit,
        todayTweetCount: config.todayTweetCount,
        personality: config.personality,
        tweetTopics: config.tweetTopics,
      },
    });
  } catch (error: any) {
    console.error("Error updating Twitter config:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/config", authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const botAgent = await twitterService.getTwitterBotAgent();
    if (!botAgent) {
      return res.status(404).json({ error: "Twitter bot not set up" });
    }

    const config = await twitterService.getBotConfig(botAgent.id);
    if (!config) {
      return res.status(404).json({ error: "Bot config not found" });
    }

    res.json({
      agentId: botAgent.id,
      agentName: botAgent.name,
      isActive: config.isActive,
      tweetIntervalMinutes: config.tweetIntervalMinutes,
      dailyTweetLimit: config.dailyTweetLimit,
      todayTweetCount: config.todayTweetCount,
      lastTweetAt: config.lastTweetAt,
      systemPrompt: config.systemPrompt,
      personality: config.personality,
      tweetTopics: config.tweetTopics,
    });
  } catch (error: any) {
    console.error("Error getting Twitter config:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/generate", authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const botAgent = await twitterService.getTwitterBotAgent();
    if (!botAgent) {
      return res.status(404).json({ error: "Twitter bot not set up" });
    }

    const config = await twitterService.getBotConfig(botAgent.id);
    if (!config) {
      return res.status(404).json({ error: "Bot config not found" });
    }

    const parsed = generateTweetSchema.safeParse(req.body);
    const topic = parsed.success ? parsed.data.topic : undefined;
    const style = parsed.success ? parsed.data.style : config.personality as any;

    const content = await twitterService.generateTweet(config.systemPrompt, {
      topic,
      style: style || "professional",
      includeHashtags: true,
      includeEmojis: true,
    });

    res.json({ success: true, content, characterCount: content.length });
  } catch (error: any) {
    console.error("Error generating tweet:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/post", authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const botAgent = await twitterService.getTwitterBotAgent();
    if (!botAgent) {
      return res.status(404).json({ error: "Twitter bot not set up" });
    }

    const result = await twitterService.generateAndPostTweet(botAgent.id);
    
    if (result.success) {
      res.json({ success: true, tweet: result.tweet });
    } else {
      res.status(400).json({ success: false, error: result.error, tweet: result.tweet });
    }
  } catch (error: any) {
    console.error("Error posting tweet:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/post-manual", authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "Content is required and must be a string." });
    }
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0 || trimmedContent.length > 280) {
      return res.status(400).json({ error: "Content must be 1-280 characters." });
    }

    const botAgent = await twitterService.getTwitterBotAgent();
    if (!botAgent) {
      return res.status(404).json({ error: "Twitter bot not set up" });
    }

    const savedTweet = await twitterService.saveTweet(botAgent.id, content, "pending");

    if (!twitterService.isConfigured()) {
      await twitterService.updateTweetStatus(savedTweet.id, "failed", undefined, "Twitter API not configured");
      return res.json({ 
        success: false, 
        tweet: savedTweet, 
        error: "Twitter API not configured - tweet saved but not posted" 
      });
    }

    const postResult = await twitterService.postTweet(content);

    if (postResult.success) {
      await twitterService.updateTweetStatus(savedTweet.id, "posted", postResult.tweetId);
      res.json({ success: true, tweet: { ...savedTweet, tweetId: postResult.tweetId, status: "posted" } });
    } else {
      await twitterService.updateTweetStatus(savedTweet.id, "failed", undefined, postResult.error);
      res.json({ success: false, tweet: savedTweet, error: postResult.error });
    }
  } catch (error: any) {
    console.error("Error posting manual tweet:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/tweets", authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const botAgent = await twitterService.getTwitterBotAgent();
    if (!botAgent) {
      return res.status(404).json({ error: "Twitter bot not set up" });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const tweets = await twitterService.getRecentTweets(botAgent.id, Math.min(limit, 100));

    res.json({ tweets });
  } catch (error: any) {
    console.error("Error getting tweets:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/activate", authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const botAgent = await twitterService.getTwitterBotAgent();
    if (!botAgent) {
      return res.status(404).json({ error: "Twitter bot not set up" });
    }

    const config = await twitterService.createOrUpdateBotConfig(botAgent.id, { isActive: true });
    res.json({ success: true, isActive: config.isActive });
  } catch (error: any) {
    console.error("Error activating Twitter bot:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/deactivate", authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const botAgent = await twitterService.getTwitterBotAgent();
    if (!botAgent) {
      return res.status(404).json({ error: "Twitter bot not set up" });
    }

    const config = await twitterService.createOrUpdateBotConfig(botAgent.id, { isActive: false });
    res.json({ success: true, isActive: config.isActive });
  } catch (error: any) {
    console.error("Error deactivating Twitter bot:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/reply", authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { tweetId, content } = req.body;
    if (!tweetId || !content) {
      return res.status(400).json({ error: "tweetId and content are required" });
    }

    const result = await twitterService.replyToTweet(tweetId, content);
    res.json(result);
  } catch (error: any) {
    console.error("Error replying to tweet:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/outreach", authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: "username is required" });
    }

    // Get user's recent tweets
    const tweetsResult = await twitterService.getUserTweets(username.replace("@", ""), 5);
    if (!tweetsResult.success || !tweetsResult.tweets?.length) {
      return res.status(404).json({ error: tweetsResult.error || "No tweets found for user" });
    }

    // Get the most recent tweet
    const latestTweet = tweetsResult.tweets[0];
    
    // Generate a personalized reply
    const replyContent = await twitterService.generateOutreachReply(username, latestTweet.text);
    
    // Reply to their tweet
    const replyResult = await twitterService.replyToTweet(latestTweet.id, replyContent);
    
    res.json({
      success: replyResult.success,
      targetUser: username,
      targetTweet: latestTweet.text,
      reply: replyContent,
      replyId: replyResult.replyId,
      error: replyResult.error,
    });
  } catch (error: any) {
    console.error("Error in outreach:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/search", authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: "query parameter 'q' is required" });
    }

    const result = await twitterService.searchTweets(query, 10);
    res.json(result);
  } catch (error: any) {
    console.error("Error searching tweets:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/engage-moltbook", authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const result = await twitterService.searchAndEngageMoltbook();
    res.json(result);
  } catch (error: any) {
    console.error("Error engaging moltbook mentions:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/engage-launchpad", authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const result = await twitterService.searchAndEngageLaunchpad();
    res.json(result);
  } catch (error: any) {
    console.error("Error engaging launchpad mentions:", error);
    res.status(500).json({ error: error.message });
  }
});

export function registerTwitterRoutes(app: any) {
  app.use("/api/twitter", router);
}
