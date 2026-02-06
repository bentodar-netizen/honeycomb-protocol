import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { authMiddleware } from "./auth";
import { getAgentRuntime } from "./agentRuntime";
import { z } from "zod";
import crypto from "crypto";

const registerAutonomousAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  strategy: z.string().optional(),
  avatarUrl: z.string().optional(),
  metadataCid: z.string().optional(),
  controllerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const launchTokenSchema = z.object({
  name: z.string().min(1).max(64),
  symbol: z.string().min(1).max(16),
  metadataCid: z.string().optional(),
  imageUrl: z.string().optional(),
  narrative: z.string().optional(),
  graduationTargetBnb: z.string().default("5000000000000000000"),
  autoLiquidityPercent: z.number().min(50).max(100).default(80),
});

const tradeSchema = z.object({
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string(),
  minOut: z.string().default("0"),
});

export function registerAutonomousAgentRoutes(app: Express): void {
  
  app.get("/api/autonomous-agents", async (_req: Request, res: Response) => {
    try {
      const agents = await storage.getAllAutonomousAgents(100);
      res.json({ agents });
    } catch (error) {
      console.error("Error fetching autonomous agents:", error);
      res.status(500).json({ message: "Failed to fetch autonomous agents" });
    }
  });

  app.get("/api/autonomous-agents/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const agent = await storage.getAutonomousAgent(id);
      
      if (!agent) {
        return res.status(404).json({ message: "Autonomous agent not found" });
      }

      const launches = await storage.getAgentTokenLaunches(id);
      const trades = await storage.getAgentTrades(id, 50);

      res.json({
        agent,
        launches,
        recentTrades: trades,
        stats: {
          tokensLaunched: agent.totalTokensLaunched,
          graduations: agent.totalGraduations,
          trades: agent.totalTradesExecuted,
          volume: agent.totalVolumeWei,
          pnl: agent.totalPnlWei,
          reputationScore: agent.reputationScore,
        }
      });
    } catch (error) {
      console.error("Error fetching autonomous agent:", error);
      res.status(500).json({ message: "Failed to fetch autonomous agent" });
    }
  });

  app.post("/api/autonomous-agents/register", authMiddleware, async (req: Request, res: Response) => {
    try {
      const validatedData = registerAutonomousAgentSchema.parse(req.body);
      const userAddress = (req as Request & { user?: { address: string } }).user?.address;

      if (!userAddress) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const existingAgent = await storage.getAgentByAddress(userAddress);
      if (!existingAgent) {
        return res.status(400).json({ message: "You must have a Bee profile first" });
      }

      const existingAutonomous = await storage.getAutonomousAgentByAgentId(existingAgent.id);
      if (existingAutonomous) {
        return res.status(400).json({ message: "You already have an autonomous agent" });
      }

      const autonomousAgent = await storage.createAutonomousAgent({
        agentId: existingAgent.id,
        controllerAddress: validatedData.controllerAddress.toLowerCase(),
        name: validatedData.name,
        description: validatedData.description,
        strategy: validatedData.strategy,
        avatarUrl: validatedData.avatarUrl,
        metadataCid: validatedData.metadataCid,
      });

      res.json({ agent: autonomousAgent });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error registering autonomous agent:", error);
      res.status(500).json({ message: "Failed to register autonomous agent" });
    }
  });

  app.patch("/api/autonomous-agents/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userAddress = (req as Request & { user?: { address: string } }).user?.address;

      if (!userAddress) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const agent = await storage.getAutonomousAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Autonomous agent not found" });
      }

      const ownerAgent = await storage.getAgent(agent.agentId);
      if (!ownerAgent || ownerAgent.ownerAddress.toLowerCase() !== userAddress.toLowerCase()) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const updates: Record<string, unknown> = {};
      if (req.body.name) updates.name = req.body.name;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.strategy !== undefined) updates.strategy = req.body.strategy;
      if (req.body.avatarUrl !== undefined) updates.avatarUrl = req.body.avatarUrl;
      if (req.body.canDeployToken !== undefined) updates.canDeployToken = req.body.canDeployToken;
      if (req.body.canLaunch !== undefined) updates.canLaunch = req.body.canLaunch;
      if (req.body.canGraduate !== undefined) updates.canGraduate = req.body.canGraduate;
      if (req.body.canTrade !== undefined) updates.canTrade = req.body.canTrade;
      if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;

      const updated = await storage.updateAutonomousAgent(id, updates);
      res.json({ agent: updated });
    } catch (error) {
      console.error("Error updating autonomous agent:", error);
      res.status(500).json({ message: "Failed to update autonomous agent" });
    }
  });

  app.get("/api/autonomous-agents/:id/tokens", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const launches = await storage.getAgentTokenLaunches(id);
      res.json({ tokens: launches });
    } catch (error) {
      console.error("Error fetching agent tokens:", error);
      res.status(500).json({ message: "Failed to fetch agent tokens" });
    }
  });

  app.get("/api/autonomous-agents/:id/trades", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const trades = await storage.getAgentTrades(id, limit);
      res.json({ trades });
    } catch (error) {
      console.error("Error fetching agent trades:", error);
      res.status(500).json({ message: "Failed to fetch agent trades" });
    }
  });

  app.get("/api/agent-token-launches", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const status = req.query.status as string | undefined;
      const launches = await storage.getAllAgentTokenLaunches(limit, status);
      res.json({ launches });
    } catch (error) {
      console.error("Error fetching agent token launches:", error);
      res.status(500).json({ message: "Failed to fetch agent token launches" });
    }
  });

  app.get("/api/agent-token-launches/:tokenAddress", async (req: Request, res: Response) => {
    try {
      const { tokenAddress } = req.params;
      const launch = await storage.getAgentTokenLaunch(tokenAddress);
      
      if (!launch) {
        return res.status(404).json({ message: "Token launch not found" });
      }

      const agent = await storage.getAutonomousAgent(launch.autonomousAgentId);
      const trades = await storage.getAgentTradesByToken(tokenAddress, 50);

      const runtime = getAgentRuntime();
      let tokenStatus = null;
      if (runtime) {
        tokenStatus = await runtime.getTokenStatus(tokenAddress);
      }

      res.json({
        launch,
        agent,
        trades,
        tokenStatus
      });
    } catch (error) {
      console.error("Error fetching agent token launch:", error);
      res.status(500).json({ message: "Failed to fetch agent token launch" });
    }
  });

  app.post("/api/autonomous-agents/:id/queue-launch", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = launchTokenSchema.parse(req.body);
      const userAddress = (req as Request & { user?: { address: string } }).user?.address;

      if (!userAddress) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const agent = await storage.getAutonomousAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Autonomous agent not found" });
      }

      const ownerAgent = await storage.getAgent(agent.agentId);
      if (!ownerAgent || ownerAgent.ownerAddress.toLowerCase() !== userAddress.toLowerCase()) {
        return res.status(403).json({ message: "Not authorized" });
      }

      if (!agent.canDeployToken || !agent.canLaunch) {
        return res.status(403).json({ message: "Agent does not have launch permissions" });
      }

      const runtime = getAgentRuntime();
      if (!runtime) {
        return res.status(503).json({ message: "Agent runtime not available" });
      }

      const salt = `0x${Buffer.from(crypto.randomBytes(32)).toString('hex')}`;
      
      runtime.queueAction({
        type: 'launch',
        agentId: id,
        params: {
          name: validatedData.name,
          symbol: validatedData.symbol,
          metadataCID: validatedData.metadataCid || '',
          narrative: validatedData.narrative || '',
          creatorBeeId: 0,
          salt
        }
      });

      res.json({ 
        message: "Launch queued successfully",
        queuedParams: {
          name: validatedData.name,
          symbol: validatedData.symbol,
          salt
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error queueing launch:", error);
      res.status(500).json({ message: "Failed to queue launch" });
    }
  });

  app.post("/api/autonomous-agents/:id/queue-buy", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = tradeSchema.parse(req.body);
      const userAddress = (req as Request & { user?: { address: string } }).user?.address;

      if (!userAddress) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const agent = await storage.getAutonomousAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Autonomous agent not found" });
      }

      if (!agent.canTrade) {
        return res.status(403).json({ message: "Agent does not have trade permissions" });
      }

      const runtime = getAgentRuntime();
      if (!runtime) {
        return res.status(503).json({ message: "Agent runtime not available" });
      }

      runtime.queueAction({
        type: 'buy',
        agentId: id,
        params: {
          tokenAddress: validatedData.tokenAddress,
          amount: validatedData.amount,
          minOut: validatedData.minOut
        }
      });

      res.json({ message: "Buy queued successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error queueing buy:", error);
      res.status(500).json({ message: "Failed to queue buy" });
    }
  });

  app.post("/api/autonomous-agents/:id/queue-sell", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = tradeSchema.parse(req.body);
      const userAddress = (req as Request & { user?: { address: string } }).user?.address;

      if (!userAddress) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const agent = await storage.getAutonomousAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Autonomous agent not found" });
      }

      if (!agent.canTrade) {
        return res.status(403).json({ message: "Agent does not have trade permissions" });
      }

      const runtime = getAgentRuntime();
      if (!runtime) {
        return res.status(503).json({ message: "Agent runtime not available" });
      }

      runtime.queueAction({
        type: 'sell',
        agentId: id,
        params: {
          tokenAddress: validatedData.tokenAddress,
          tokenAmount: validatedData.amount,
          minOut: validatedData.minOut
        }
      });

      res.json({ message: "Sell queued successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error queueing sell:", error);
      res.status(500).json({ message: "Failed to queue sell" });
    }
  });

  app.get("/api/agent-leaderboard", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const leaderboard = await storage.getAgentLeaderboard(limit);

      const enrichedLeaderboard = await Promise.all(
        leaderboard.map(async (entry) => {
          const agent = await storage.getAutonomousAgent(entry.autonomousAgentId);
          return {
            ...entry,
            agent: agent ? {
              id: agent.id,
              name: agent.name,
              avatarUrl: agent.avatarUrl,
              strategy: agent.strategy
            } : null
          };
        })
      );

      res.json({ leaderboard: enrichedLeaderboard });
    } catch (error) {
      console.error("Error fetching agent leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch agent leaderboard" });
    }
  });

  app.get("/api/agent-graduations", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const launches = await storage.getAllAgentTokenLaunches(limit, 'graduated');
      res.json({ graduations: launches });
    } catch (error) {
      console.error("Error fetching agent graduations:", error);
      res.status(500).json({ message: "Failed to fetch agent graduations" });
    }
  });

  app.get("/api/autonomous-agents/stats/overview", async (_req: Request, res: Response) => {
    try {
      const agents = await storage.getAllAutonomousAgents(1000);
      const allLaunches = await storage.getAllAgentTokenLaunches(1000);
      
      const totalAgents = agents.length;
      const activeAgents = agents.filter(a => a.isActive).length;
      const totalLaunches = allLaunches.length;
      const totalGraduations = allLaunches.filter(l => l.status === 'graduated').length;
      const totalVolume = agents.reduce((sum, a) => sum + BigInt(a.totalVolumeWei), BigInt(0));
      const totalTrades = agents.reduce((sum, a) => sum + a.totalTradesExecuted, 0);

      res.json({
        totalAgents,
        activeAgents,
        totalLaunches,
        totalGraduations,
        graduationRate: totalLaunches > 0 ? (totalGraduations / totalLaunches * 100).toFixed(2) : 0,
        totalVolume: totalVolume.toString(),
        totalTrades
      });
    } catch (error) {
      console.error("Error fetching autonomous agent stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  console.log("[Routes] Autonomous agent routes registered");
}
