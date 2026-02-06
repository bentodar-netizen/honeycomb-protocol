import { Router, Request, Response } from "express";
import { db } from "./db";
import { 
  nfaAgents, 
  nfaMemory, 
  nfaTrainingHistory, 
  nfaInteractions, 
  nfaListings, 
  nfaVerifications, 
  nfaStats, 
  nfaRatings,
  nfaTemplates,
  nfaLearningModules,
  nfaLearningMetrics,
  nfaVaultPermissions,
  nfaActions,
  insertNfaAgentSchema,
  insertNfaMemorySchema,
  insertNfaInteractionSchema,
  insertNfaListingSchema,
  insertNfaRatingSchema,
  insertNfaVaultPermissionSchema,
  insertNfaActionSchema
} from "@shared/schema";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import crypto from "crypto";
import { authMiddleware, optionalAuthMiddleware } from "./auth";

export const nfaRouter = Router();

function generateProofOfPrompt(systemPrompt: string, modelType: string): string {
  const data = `${systemPrompt}:${modelType}:${Date.now()}`;
  return "0x" + crypto.createHash("sha256").update(data).digest("hex");
}

function generateMemoryRoot(memoryData: Record<string, string>): string {
  const data = JSON.stringify(memoryData);
  return "0x" + crypto.createHash("sha256").update(data).digest("hex");
}

// ==================== NFA Agents ====================

nfaRouter.get("/agents", async (req: Request, res: Response) => {
  try {
    const { category, status, agentType, owner, limit = "20", offset = "0" } = req.query;

    let agents = await db
      .select()
      .from(nfaAgents)
      .orderBy(desc(nfaAgents.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    if (category) {
      agents = agents.filter(a => a.category === category);
    }
    if (status) {
      agents = agents.filter(a => a.status === status);
    }
    if (agentType) {
      agents = agents.filter(a => a.agentType === agentType);
    }
    if (owner) {
      agents = agents.filter(a => a.ownerAddress.toLowerCase() === (owner as string).toLowerCase());
    }

    res.json({ agents, total: agents.length });
  } catch (error) {
    console.error("Error fetching NFA agents:", error);
    res.json({ agents: [], total: 0 });
  }
});

nfaRouter.get("/agents/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, id));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    const agent = agents[0];

    const stats = await db.select().from(nfaStats).where(eq(nfaStats.nfaId, id));
    const verification = await db.select().from(nfaVerifications).where(eq(nfaVerifications.nfaId, id));
    const listing = await db.select().from(nfaListings).where(eq(nfaListings.nfaId, id));
    
    // BAP-578: Include learning metrics if learning is enabled
    let learningMetrics = null;
    let learningModule = null;
    if (agent.learningEnabled) {
      const metrics = await db.select().from(nfaLearningMetrics).where(eq(nfaLearningMetrics.nfaId, id));
      learningMetrics = metrics[0] || { 
        totalInteractions: 0, learningEvents: 0, 
        learningVelocity: "0", confidenceScore: "0",
        treeDepth: 0, totalNodes: 0 
      };
      
      if (agent.learningModuleId) {
        const modules = await db.select().from(nfaLearningModules).where(eq(nfaLearningModules.id, agent.learningModuleId));
        learningModule = modules[0] || null;
      }
    }

    // BAP-578: Include template info if from template
    let template = null;
    if (agent.templateId) {
      const templates = await db.select().from(nfaTemplates).where(eq(nfaTemplates.id, agent.templateId));
      template = templates[0] || null;
    }

    res.json({
      agent,
      stats: stats[0] || { totalInteractions: 0, totalRevenue: "0", rating: 0, ratingCount: 0 },
      verification: verification[0] || { status: "UNVERIFIED" },
      listing: listing[0]?.active ? listing[0] : null,
      // BAP-578 enhanced data
      learningMetrics,
      learningModule,
      template
    });
  } catch (error) {
    console.error("Error fetching NFA agent:", error);
    res.status(500).json({ error: "Failed to fetch agent" });
  }
});

nfaRouter.get("/agents/token/:tokenId", async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId);

    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.tokenId, tokenId));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }

    res.json({ agent: agents[0] });
  } catch (error) {
    console.error("Error fetching NFA agent:", error);
    res.status(500).json({ error: "Failed to fetch agent" });
  }
});

nfaRouter.post("/agents/mint", authMiddleware, async (req: Request, res: Response) => {
  try {
    const validated = insertNfaAgentSchema.parse(req.body);
    
    // Verify the wallet address matches the authenticated user
    if (validated.ownerAddress.toLowerCase() !== req.walletAddress?.toLowerCase()) {
      return res.status(403).json({ error: "Cannot mint NFA for a different wallet" });
    }
    
    const proofOfPrompt = validated.proofOfPrompt || 
      generateProofOfPrompt(validated.systemPrompt || "", validated.modelType);

    const memoryRoot = validated.memoryRoot || generateMemoryRoot({});

    // BAP-578 enhanced agent creation
    const result = await db.insert(nfaAgents).values({
      tokenId: validated.tokenId,
      ownerAddress: validated.ownerAddress.toLowerCase(),
      agentId: validated.agentId,
      name: validated.name,
      description: validated.description,
      modelType: validated.modelType,
      agentType: validated.agentType || "STATIC",
      proofOfPrompt,
      memoryRoot,
      metadataUri: validated.metadataUri,
      category: validated.category,
      systemPrompt: validated.systemPrompt,
      // BAP-578 enhanced metadata
      persona: validated.persona,
      experience: validated.experience,
      voiceHash: validated.voiceHash,
      animationUri: validated.animationUri,
      vaultUri: validated.vaultUri,
      vaultHash: validated.vaultHash,
      logicAddress: validated.logicAddress,
      // BAP-578 learning configuration
      learningEnabled: validated.learningEnabled || false,
      learningModuleId: validated.learningModuleId,
      learningTreeRoot: validated.learningTreeRoot,
      templateId: validated.templateId,
    }).returning();

    const agent = result[0];

    await db.insert(nfaStats).values({
      nfaId: agent.id,
      totalInteractions: 0,
      totalRevenue: "0",
      rating: 0,
      ratingCount: 0,
      weeklyInteractions: 0,
      monthlyInteractions: 0,
    });

    await db.insert(nfaVerifications).values({
      nfaId: agent.id,
      status: "UNVERIFIED",
    });

    // Initialize learning metrics if learning is enabled
    if (agent.learningEnabled) {
      await db.insert(nfaLearningMetrics).values({
        nfaId: agent.id,
        totalInteractions: 0,
        learningEvents: 0,
        learningVelocity: "0",
        confidenceScore: "0",
        treeDepth: 0,
        totalNodes: 0
      });
    }

    res.json({ agent, proofOfPrompt, memoryRoot });
  } catch (error: any) {
    console.error("Error minting NFA agent:", error);
    const errorMessage = error?.message || error?.toString() || "Failed to mint agent";
    res.status(500).json({ error: errorMessage });
  }
});

nfaRouter.patch("/agents/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      name, description, category, memoryRoot,
      // BAP-578 fields
      persona, experience, voiceHash, animationUri, vaultUri, vaultHash,
      logicAddress, systemPrompt
    } = req.body;

    // Verify ownership
    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, id));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    if (agents[0].ownerAddress.toLowerCase() !== req.walletAddress?.toLowerCase()) {
      return res.status(403).json({ error: "Only the owner can update this agent" });
    }

    // Cannot update terminated agents
    if (agents[0].status === "TERMINATED") {
      return res.status(400).json({ error: "Cannot update a terminated agent" });
    }

    const updateData: any = { lastActiveAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (memoryRoot !== undefined) updateData.memoryRoot = memoryRoot;
    // BAP-578 fields
    if (persona !== undefined) updateData.persona = persona;
    if (experience !== undefined) updateData.experience = experience;
    if (voiceHash !== undefined) updateData.voiceHash = voiceHash;
    if (animationUri !== undefined) updateData.animationUri = animationUri;
    if (vaultUri !== undefined) updateData.vaultUri = vaultUri;
    if (vaultHash !== undefined) updateData.vaultHash = vaultHash;
    if (logicAddress !== undefined) updateData.logicAddress = logicAddress;
    if (systemPrompt !== undefined) {
      updateData.systemPrompt = systemPrompt;
      // Update proof of prompt hash when system prompt changes
      updateData.proofOfPrompt = "0x" + crypto.createHash("sha256")
        .update(`${systemPrompt}:${agents[0].modelType}:${Date.now()}`)
        .digest("hex");
    }

    const result = await db
      .update(nfaAgents)
      .set(updateData)
      .where(eq(nfaAgents.id, id))
      .returning();

    res.json({ agent: result[0] });
  } catch (error) {
    console.error("Error updating NFA agent:", error);
    res.status(500).json({ error: "Failed to update agent" });
  }
});

// ==================== Memory Vault ====================

nfaRouter.get("/agents/:id/memory", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const memory = await db
      .select()
      .from(nfaMemory)
      .where(eq(nfaMemory.nfaId, id))
      .orderBy(desc(nfaMemory.updatedAt));

    res.json({ memory });
  } catch (error) {
    console.error("Error fetching memory:", error);
    res.json({ memory: [] });
  }
});

nfaRouter.post("/agents/:id/memory", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = insertNfaMemorySchema.parse({ ...req.body, nfaId: id });

    // Verify ownership
    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, id));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    if (agents[0].ownerAddress.toLowerCase() !== req.walletAddress?.toLowerCase()) {
      return res.status(403).json({ error: "Only the owner can update memory" });
    }

    const existing = await db
      .select()
      .from(nfaMemory)
      .where(and(eq(nfaMemory.nfaId, id), eq(nfaMemory.memoryKey, validated.memoryKey)));

    let memory;
    if (existing.length > 0) {
      const result = await db
        .update(nfaMemory)
        .set({
          memoryValue: validated.memoryValue,
          version: existing[0].version + 1,
          updatedAt: new Date(),
        })
        .where(eq(nfaMemory.id, existing[0].id))
        .returning();
      memory = result[0];
    } else {
      const result = await db.insert(nfaMemory).values({
        nfaId: validated.nfaId,
        memoryKey: validated.memoryKey,
        memoryValue: validated.memoryValue,
      }).returning();
      memory = result[0];
    }

    const allMemory = await db.select().from(nfaMemory).where(eq(nfaMemory.nfaId, id));
    const memoryObj: Record<string, string> = {};
    allMemory.forEach(m => { memoryObj[m.memoryKey] = m.memoryValue; });
    const newMemoryRoot = generateMemoryRoot(memoryObj);

    await db
      .update(nfaAgents)
      .set({ memoryRoot: newMemoryRoot, lastActiveAt: new Date() })
      .where(eq(nfaAgents.id, id));

    res.json({ memory, memoryRoot: newMemoryRoot });
  } catch (error) {
    console.error("Error updating memory:", error);
    res.status(500).json({ error: "Failed to update memory" });
  }
});

// ==================== Training ====================

nfaRouter.get("/agents/:id/training", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const history = await db
      .select()
      .from(nfaTrainingHistory)
      .where(eq(nfaTrainingHistory.nfaId, id))
      .orderBy(desc(nfaTrainingHistory.version));

    res.json({ history });
  } catch (error) {
    console.error("Error fetching training history:", error);
    res.json({ history: [] });
  }
});

nfaRouter.post("/agents/:id/training", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { trainingData } = req.body;

    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, id));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    const agent = agents[0];

    if (agent.agentType !== "LEARNING") {
      return res.status(400).json({ error: "Agent is not a learning agent" });
    }

    const newVersion = agent.trainingVersion + 1;
    const trainingHash = "0x" + crypto.createHash("sha256").update(trainingData || "").digest("hex");

    const result = await db.insert(nfaTrainingHistory).values({
      nfaId: id,
      version: newVersion,
      trainingHash,
      trainingData,
    }).returning();

    await db
      .update(nfaAgents)
      .set({ trainingVersion: newVersion, lastActiveAt: new Date() })
      .where(eq(nfaAgents.id, id));

    res.json({ training: result[0] });
  } catch (error) {
    console.error("Error updating training:", error);
    res.status(500).json({ error: "Failed to update training" });
  }
});

// ==================== Interactions ====================

nfaRouter.post("/agents/:id/interact", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = insertNfaInteractionSchema.parse({ ...req.body, nfaId: id });

    const result = await db.insert(nfaInteractions).values({
      nfaId: validated.nfaId,
      callerAddress: validated.callerAddress.toLowerCase(),
      interactionType: validated.interactionType,
      inputHash: validated.inputHash,
      outputHash: validated.outputHash,
      tokensUsed: validated.tokensUsed,
      cost: validated.cost,
    }).returning();

    await db
      .update(nfaAgents)
      .set({ 
        interactionCount: sql`${nfaAgents.interactionCount} + 1`,
        lastActiveAt: new Date() 
      })
      .where(eq(nfaAgents.id, id));

    await db
      .update(nfaStats)
      .set({
        totalInteractions: sql`${nfaStats.totalInteractions} + 1`,
        weeklyInteractions: sql`${nfaStats.weeklyInteractions} + 1`,
        monthlyInteractions: sql`${nfaStats.monthlyInteractions} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(nfaStats.nfaId, id));

    res.json({ interaction: result[0] });
  } catch (error) {
    console.error("Error recording interaction:", error);
    res.status(500).json({ error: "Failed to record interaction" });
  }
});

nfaRouter.get("/agents/:id/interactions", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = "50" } = req.query;

    const interactions = await db
      .select()
      .from(nfaInteractions)
      .where(eq(nfaInteractions.nfaId, id))
      .orderBy(desc(nfaInteractions.createdAt))
      .limit(parseInt(limit as string));

    res.json({ interactions });
  } catch (error) {
    console.error("Error fetching interactions:", error);
    res.json({ interactions: [] });
  }
});

// ==================== Marketplace ====================

nfaRouter.get("/marketplace/listings", async (req: Request, res: Response) => {
  try {
    const { limit = "20", offset = "0" } = req.query;

    const listings = await db
      .select({
        listing: nfaListings,
        agent: nfaAgents,
      })
      .from(nfaListings)
      .innerJoin(nfaAgents, eq(nfaListings.nfaId, nfaAgents.id))
      .where(eq(nfaListings.active, true))
      .orderBy(desc(nfaListings.listedAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({ listings });
  } catch (error) {
    console.error("Error fetching marketplace:", error);
    res.json({ listings: [] });
  }
});

nfaRouter.post("/marketplace/list", authMiddleware, async (req: Request, res: Response) => {
  try {
    const validated = insertNfaListingSchema.parse(req.body);

    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, validated.nfaId));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Verify ownership - only owner can list
    if (agents[0].ownerAddress.toLowerCase() !== req.walletAddress?.toLowerCase()) {
      return res.status(403).json({ error: "Only the owner can list this agent" });
    }

    const existing = await db.select().from(nfaListings).where(eq(nfaListings.nfaId, validated.nfaId));
    
    let listing;
    if (existing.length > 0) {
      const result = await db
        .update(nfaListings)
        .set({
          priceWei: validated.priceWei,
          priceDisplay: validated.priceDisplay,
          active: true,
          listedAt: new Date(),
        })
        .where(eq(nfaListings.id, existing[0].id))
        .returning();
      listing = result[0];
    } else {
      const result = await db.insert(nfaListings).values({
        nfaId: validated.nfaId,
        sellerAddress: req.walletAddress!.toLowerCase(),
        priceWei: validated.priceWei,
        priceDisplay: validated.priceDisplay,
      }).returning();
      listing = result[0];
    }

    res.json({ listing });
  } catch (error) {
    console.error("Error listing agent:", error);
    res.status(500).json({ error: "Failed to list agent" });
  }
});

nfaRouter.post("/marketplace/delist/:nfaId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { nfaId } = req.params;

    // Verify ownership
    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, nfaId));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    if (agents[0].ownerAddress.toLowerCase() !== req.walletAddress?.toLowerCase()) {
      return res.status(403).json({ error: "Only the owner can delist this agent" });
    }

    await db
      .update(nfaListings)
      .set({ active: false })
      .where(eq(nfaListings.nfaId, nfaId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error delisting agent:", error);
    res.status(500).json({ error: "Failed to delist agent" });
  }
});

// Platform fee configuration - 1% fee on all NFA marketplace transactions
const NFA_PLATFORM_FEE_PERCENT = 1;
const NFA_FEE_WALLET = "0xEA42922A5c695bD947246988B7927fbD3fD889fF";

// Buy an NFA from the marketplace
nfaRouter.post("/marketplace/buy", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { nfaId, txHash, onChain } = req.body;
    const buyerAddress = req.walletAddress!.toLowerCase();

    // Get the listing
    const listings = await db.select().from(nfaListings).where(
      and(eq(nfaListings.nfaId, nfaId), eq(nfaListings.active, true))
    );
    if (listings.length === 0) {
      return res.status(404).json({ error: "Listing not found or not active" });
    }
    const listing = listings[0];

    // Get the agent
    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, nfaId));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    const agent = agents[0];

    // Cannot buy your own agent
    if (agent.ownerAddress.toLowerCase() === buyerAddress) {
      return res.status(400).json({ error: "Cannot buy your own agent" });
    }

    // Calculate fees (1% platform fee)
    const priceWei = BigInt(listing.priceWei);
    const platformFeeWei = (priceWei * BigInt(NFA_PLATFORM_FEE_PERCENT)) / BigInt(100);
    const sellerReceivesWei = priceWei - platformFeeWei;

    // Record the sale
    await db
      .update(nfaListings)
      .set({
        active: false,
        soldAt: new Date(),
        buyerAddress,
      })
      .where(eq(nfaListings.id, listing.id));

    // Transfer ownership
    await db
      .update(nfaAgents)
      .set({ ownerAddress: buyerAddress })
      .where(eq(nfaAgents.id, nfaId));

    // Update agent stats - handle case where stats might not exist
    const existingStats = await db.select().from(nfaStats).where(eq(nfaStats.nfaId, nfaId));
    const priceNum = parseFloat(listing.priceDisplay) || 0;
    
    if (existingStats.length > 0) {
      // Parse existing revenue (remove " BNB" suffix if present)
      const currentRevenue = parseFloat(existingStats[0].totalRevenue?.replace(' BNB', '') || '0');
      const newRevenue = (currentRevenue + priceNum).toFixed(4);
      
      await db
        .update(nfaStats)
        .set({
          totalRevenue: newRevenue,
          updatedAt: new Date(),
        })
        .where(eq(nfaStats.nfaId, nfaId));
    } else {
      // Create stats entry if it doesn't exist
      await db.insert(nfaStats).values({
        nfaId,
        totalInteractions: 0,
        totalRevenue: priceNum.toFixed(4),
        rating: 0,
        ratingCount: 0,
      });
    }

    // Log the action
    await db.insert(nfaActions).values({
      nfaId,
      actionType: "TRANSFER",
      executorAddress: buyerAddress,
      actionData: JSON.stringify({
        type: "MARKETPLACE_SALE",
        from: agent.ownerAddress,
        to: buyerAddress,
        priceWei: listing.priceWei,
        priceDisplay: listing.priceDisplay,
        platformFeeWei: platformFeeWei.toString(),
        platformFeePercent: NFA_PLATFORM_FEE_PERCENT,
        sellerReceivesWei: sellerReceivesWei.toString(),
        feeWallet: NFA_FEE_WALLET,
        onChain: onChain || false,
      }),
      txHash: txHash || null,
      success: true,
    });

    res.json({ 
      success: true,
      txHash: txHash || null,
      onChain: onChain || false,
      sale: {
        nfaId,
        nfaName: agent.name,
        sellerAddress: listing.sellerAddress,
        buyerAddress,
        priceWei: listing.priceWei,
        priceDisplay: listing.priceDisplay,
        platformFee: {
          percent: NFA_PLATFORM_FEE_PERCENT,
          wei: platformFeeWei.toString(),
          display: (parseFloat(listing.priceDisplay) * NFA_PLATFORM_FEE_PERCENT / 100).toFixed(6),
          wallet: NFA_FEE_WALLET,
        },
        sellerReceives: {
          wei: sellerReceivesWei.toString(),
          display: (parseFloat(listing.priceDisplay) * (100 - NFA_PLATFORM_FEE_PERCENT) / 100).toFixed(6),
        },
        soldAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error("Error processing purchase:", error);
    res.status(500).json({ error: "Failed to process purchase" });
  }
});

// Legacy endpoint for recording sales (keeping for backward compatibility)
nfaRouter.post("/marketplace/sold", async (req: Request, res: Response) => {
  try {
    const { nfaId, buyerAddress, price } = req.body;

    // Calculate 1% platform fee
    const priceNum = parseFloat(price) || 0;
    const platformFee = priceNum * NFA_PLATFORM_FEE_PERCENT / 100;
    const sellerReceives = priceNum - platformFee;

    await db
      .update(nfaListings)
      .set({
        active: false,
        soldAt: new Date(),
        buyerAddress: buyerAddress.toLowerCase(),
      })
      .where(eq(nfaListings.nfaId, nfaId));

    await db
      .update(nfaAgents)
      .set({ ownerAddress: buyerAddress.toLowerCase() })
      .where(eq(nfaAgents.id, nfaId));

    // Update agent stats - handle case where stats might not exist
    const existingStats = await db.select().from(nfaStats).where(eq(nfaStats.nfaId, nfaId));
    
    if (existingStats.length > 0) {
      const currentRevenue = parseFloat(existingStats[0].totalRevenue?.replace(' BNB', '') || '0');
      const newRevenue = (currentRevenue + priceNum).toFixed(4);
      
      await db
        .update(nfaStats)
        .set({
          totalRevenue: newRevenue,
          updatedAt: new Date(),
        })
        .where(eq(nfaStats.nfaId, nfaId));
    } else {
      await db.insert(nfaStats).values({
        nfaId,
        totalInteractions: 0,
        totalRevenue: priceNum.toFixed(4),
        rating: 0,
        ratingCount: 0,
      });
    }

    res.json({ 
      success: true,
      platformFee: {
        percent: NFA_PLATFORM_FEE_PERCENT,
        amount: platformFee.toFixed(6),
        wallet: NFA_FEE_WALLET,
      },
      sellerReceives: sellerReceives.toFixed(6),
    });
  } catch (error) {
    console.error("Error recording sale:", error);
    res.status(500).json({ error: "Failed to record sale" });
  }
});

// Get marketplace fee info
nfaRouter.get("/marketplace/fees", async (req: Request, res: Response) => {
  res.json({
    platformFeePercent: NFA_PLATFORM_FEE_PERCENT,
    feeWallet: NFA_FEE_WALLET,
    description: "1% of all NFA marketplace transactions goes to the platform fee wallet",
  });
});

// ==================== Ratings ====================

nfaRouter.post("/agents/:id/rate", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = insertNfaRatingSchema.parse({ ...req.body, nfaId: id });

    // Verify the rater matches the authenticated user
    if (validated.raterAddress.toLowerCase() !== req.walletAddress?.toLowerCase()) {
      return res.status(403).json({ error: "Cannot rate on behalf of another wallet" });
    }

    // Check if user owns this agent (cannot rate your own agent)
    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, id));
    if (agents.length > 0 && agents[0].ownerAddress.toLowerCase() === req.walletAddress?.toLowerCase()) {
      return res.status(400).json({ error: "Cannot rate your own agent" });
    }

    const existing = await db
      .select()
      .from(nfaRatings)
      .where(and(
        eq(nfaRatings.nfaId, id),
        eq(nfaRatings.raterAddress, req.walletAddress!.toLowerCase())
      ));

    if (existing.length > 0) {
      return res.status(400).json({ error: "Already rated this agent" });
    }

    const result = await db.insert(nfaRatings).values({
      nfaId: validated.nfaId,
      raterAddress: req.walletAddress!.toLowerCase(),
      rating: validated.rating,
      review: validated.review,
    }).returning();

    const stats = await db.select().from(nfaStats).where(eq(nfaStats.nfaId, id));
    if (stats.length > 0) {
      const s = stats[0];
      const newRating = ((s.rating || 0) * s.ratingCount + validated.rating) / (s.ratingCount + 1);
      await db
        .update(nfaStats)
        .set({
          rating: newRating,
          ratingCount: s.ratingCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(nfaStats.nfaId, id));
    }

    res.json({ rating: result[0] });
  } catch (error) {
    console.error("Error rating agent:", error);
    res.status(500).json({ error: "Failed to rate agent" });
  }
});

nfaRouter.get("/agents/:id/ratings", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ratings = await db
      .select()
      .from(nfaRatings)
      .where(eq(nfaRatings.nfaId, id))
      .orderBy(desc(nfaRatings.createdAt));

    res.json({ ratings });
  } catch (error) {
    console.error("Error fetching ratings:", error);
    res.json({ ratings: [] });
  }
});

// ==================== Leaderboard ====================

nfaRouter.get("/leaderboard/interactions", async (req: Request, res: Response) => {
  try {
    const { limit = "10" } = req.query;

    const agents = await db
      .select({
        agent: nfaAgents,
        stats: nfaStats,
      })
      .from(nfaAgents)
      .leftJoin(nfaStats, eq(nfaAgents.id, nfaStats.nfaId))
      .where(eq(nfaAgents.status, "ACTIVE"))
      .orderBy(desc(nfaStats.totalInteractions))
      .limit(parseInt(limit as string));

    res.json({ agents });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.json({ agents: [] });
  }
});

nfaRouter.get("/leaderboard/rating", async (req: Request, res: Response) => {
  try {
    const { limit = "10" } = req.query;

    const agents = await db
      .select({
        agent: nfaAgents,
        stats: nfaStats,
      })
      .from(nfaAgents)
      .innerJoin(nfaStats, eq(nfaAgents.id, nfaStats.nfaId))
      .where(eq(nfaAgents.status, "ACTIVE"))
      .orderBy(desc(nfaStats.rating))
      .limit(parseInt(limit as string));

    res.json({ agents });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.json({ agents: [] });
  }
});

nfaRouter.get("/leaderboard/revenue", async (req: Request, res: Response) => {
  try {
    const { limit = "10" } = req.query;

    const agents = await db
      .select({
        agent: nfaAgents,
        stats: nfaStats,
      })
      .from(nfaAgents)
      .leftJoin(nfaStats, eq(nfaAgents.id, nfaStats.nfaId))
      .where(eq(nfaAgents.status, "ACTIVE"))
      .orderBy(desc(nfaStats.totalRevenue))
      .limit(parseInt(limit as string));

    res.json({ agents });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.json({ agents: [] });
  }
});

// ==================== Categories ====================

nfaRouter.get("/categories", async (req: Request, res: Response) => {
  try {
    const agents = await db.select().from(nfaAgents);
    
    const categoryCounts: Record<string, number> = {};
    agents.forEach(a => {
      if (a.category) {
        categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
      }
    });

    const categories = Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      count,
    }));

    res.json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.json({ categories: [] });
  }
});

// ==================== BAP-578 Templates ====================

nfaRouter.get("/templates", async (req: Request, res: Response) => {
  try {
    const { category, active = "true" } = req.query;
    
    let templates = await db
      .select()
      .from(nfaTemplates)
      .where(eq(nfaTemplates.isActive, active === "true"))
      .orderBy(desc(nfaTemplates.createdAt));

    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    res.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.json({ templates: [] });
  }
});

nfaRouter.get("/templates/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const templates = await db.select().from(nfaTemplates).where(eq(nfaTemplates.id, id));
    if (templates.length === 0) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json({ template: templates[0] });
  } catch (error) {
    console.error("Error fetching template:", error);
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

// ==================== BAP-578 Learning Modules ====================

nfaRouter.get("/learning-modules", async (req: Request, res: Response) => {
  try {
    const { type, active = "true" } = req.query;
    
    let modules = await db
      .select()
      .from(nfaLearningModules)
      .where(eq(nfaLearningModules.isActive, active === "true"))
      .orderBy(nfaLearningModules.name);

    if (type) {
      modules = modules.filter(m => m.moduleType === type);
    }

    res.json({ modules });
  } catch (error) {
    console.error("Error fetching learning modules:", error);
    res.json({ modules: [] });
  }
});

nfaRouter.get("/learning-modules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const modules = await db.select().from(nfaLearningModules).where(eq(nfaLearningModules.id, id));
    if (modules.length === 0) {
      return res.status(404).json({ error: "Learning module not found" });
    }

    res.json({ module: modules[0] });
  } catch (error) {
    console.error("Error fetching learning module:", error);
    res.status(500).json({ error: "Failed to fetch learning module" });
  }
});

// ==================== BAP-578 Learning Metrics ====================

nfaRouter.get("/agents/:id/learning-metrics", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const metrics = await db.select().from(nfaLearningMetrics).where(eq(nfaLearningMetrics.nfaId, id));
    
    res.json({ 
      metrics: metrics[0] || {
        totalInteractions: 0,
        learningEvents: 0,
        learningVelocity: "0",
        confidenceScore: "0",
        treeDepth: 0,
        totalNodes: 0
      }
    });
  } catch (error) {
    console.error("Error fetching learning metrics:", error);
    res.status(500).json({ error: "Failed to fetch learning metrics" });
  }
});

nfaRouter.post("/agents/:id/learning-update", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newTreeRoot, learningData, treeDepth, totalNodes } = req.body;

    // Verify ownership
    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, id));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    if (agents[0].ownerAddress.toLowerCase() !== req.walletAddress?.toLowerCase()) {
      return res.status(403).json({ error: "Only the owner can update learning" });
    }

    const agent = agents[0];
    if (!agent.learningEnabled) {
      return res.status(400).json({ error: "Agent does not have learning enabled" });
    }

    // Update agent learning root
    const newVersion = (agent.learningVersion || 0) + 1;
    await db
      .update(nfaAgents)
      .set({
        learningTreeRoot: newTreeRoot,
        learningVersion: newVersion,
        lastLearningUpdate: new Date(),
        lastActiveAt: new Date()
      })
      .where(eq(nfaAgents.id, id));

    // Update or create learning metrics
    const existingMetrics = await db.select().from(nfaLearningMetrics).where(eq(nfaLearningMetrics.nfaId, id));
    
    if (existingMetrics.length > 0) {
      await db
        .update(nfaLearningMetrics)
        .set({
          learningEvents: sql`${nfaLearningMetrics.learningEvents} + 1`,
          lastUpdateTimestamp: new Date(),
          treeDepth: treeDepth || existingMetrics[0].treeDepth,
          totalNodes: totalNodes || existingMetrics[0].totalNodes,
          updatedAt: new Date()
        })
        .where(eq(nfaLearningMetrics.nfaId, id));
    } else {
      await db.insert(nfaLearningMetrics).values({
        nfaId: id,
        learningEvents: 1,
        treeDepth: treeDepth || 0,
        totalNodes: totalNodes || 0
      });
    }

    // Log training history
    await db.insert(nfaTrainingHistory).values({
      nfaId: id,
      version: newVersion,
      trainingHash: newTreeRoot,
      trainingData: JSON.stringify(learningData)
    });

    res.json({ 
      success: true, 
      newVersion,
      learningTreeRoot: newTreeRoot 
    });
  } catch (error) {
    console.error("Error updating learning:", error);
    res.status(500).json({ error: "Failed to update learning" });
  }
});

// ==================== BAP-578 Lifecycle Management ====================

nfaRouter.post("/agents/:id/pause", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, id));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    if (agents[0].ownerAddress.toLowerCase() !== req.walletAddress?.toLowerCase()) {
      return res.status(403).json({ error: "Only the owner can pause this agent" });
    }
    if (agents[0].status === "TERMINATED") {
      return res.status(400).json({ error: "Cannot pause a terminated agent" });
    }

    const result = await db
      .update(nfaAgents)
      .set({ 
        status: "PAUSED",
        lastActiveAt: new Date()
      })
      .where(eq(nfaAgents.id, id))
      .returning();

    // Log action
    await db.insert(nfaActions).values({
      nfaId: id,
      executorAddress: req.walletAddress!.toLowerCase(),
      actionType: "PAUSE",
      status: "COMPLETED"
    });

    res.json({ agent: result[0] });
  } catch (error) {
    console.error("Error pausing agent:", error);
    res.status(500).json({ error: "Failed to pause agent" });
  }
});

nfaRouter.post("/agents/:id/unpause", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, id));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    if (agents[0].ownerAddress.toLowerCase() !== req.walletAddress?.toLowerCase()) {
      return res.status(403).json({ error: "Only the owner can unpause this agent" });
    }
    if (agents[0].status !== "PAUSED") {
      return res.status(400).json({ error: "Agent is not paused" });
    }

    const result = await db
      .update(nfaAgents)
      .set({ 
        status: "ACTIVE",
        lastActiveAt: new Date()
      })
      .where(eq(nfaAgents.id, id))
      .returning();

    // Log action
    await db.insert(nfaActions).values({
      nfaId: id,
      executorAddress: req.walletAddress!.toLowerCase(),
      actionType: "UNPAUSE",
      status: "COMPLETED"
    });

    res.json({ agent: result[0] });
  } catch (error) {
    console.error("Error unpausing agent:", error);
    res.status(500).json({ error: "Failed to unpause agent" });
  }
});

nfaRouter.post("/agents/:id/terminate", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, id));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    if (agents[0].ownerAddress.toLowerCase() !== req.walletAddress?.toLowerCase()) {
      return res.status(403).json({ error: "Only the owner can terminate this agent" });
    }
    if (agents[0].status === "TERMINATED") {
      return res.status(400).json({ error: "Agent is already terminated" });
    }

    const result = await db
      .update(nfaAgents)
      .set({ 
        status: "TERMINATED",
        lastActiveAt: new Date()
      })
      .where(eq(nfaAgents.id, id))
      .returning();

    // Deactivate any active listings
    await db
      .update(nfaListings)
      .set({ active: false })
      .where(eq(nfaListings.nfaId, id));

    // Log action
    await db.insert(nfaActions).values({
      nfaId: id,
      executorAddress: req.walletAddress!.toLowerCase(),
      actionType: "TERMINATE",
      status: "COMPLETED"
    });

    res.json({ agent: result[0] });
  } catch (error) {
    console.error("Error terminating agent:", error);
    res.status(500).json({ error: "Failed to terminate agent" });
  }
});

// ==================== BAP-578 Fund Agent ====================

nfaRouter.post("/agents/:id/fund", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, txHash } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Invalid funding amount" });
    }

    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, id));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    if (agents[0].status === "TERMINATED") {
      return res.status(400).json({ error: "Cannot fund a terminated agent" });
    }

    const agent = agents[0];
    const currentBalance = parseFloat(agent.balance || "0");
    const newBalance = (currentBalance + parseFloat(amount)).toString();

    const result = await db
      .update(nfaAgents)
      .set({
        balance: newBalance,
        lastActiveAt: new Date()
      })
      .where(eq(nfaAgents.id, id))
      .returning();

    // Log action
    await db.insert(nfaActions).values({
      nfaId: id,
      executorAddress: req.walletAddress!.toLowerCase(),
      actionType: "FUND",
      actionData: JSON.stringify({ amount }),
      txHash,
      status: "COMPLETED"
    });

    res.json({ agent: result[0], newBalance });
  } catch (error) {
    console.error("Error funding agent:", error);
    res.status(500).json({ error: "Failed to fund agent" });
  }
});

// ==================== BAP-578 Execute Action ====================

nfaRouter.post("/agents/:id/execute", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { actionType, actionData, txHash } = req.body;

    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, id));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    
    const agent = agents[0];
    if (agent.status !== "ACTIVE") {
      return res.status(400).json({ error: `Agent is ${agent.status}, cannot execute actions` });
    }

    // Check vault permissions - owner can always execute
    if (agent.ownerAddress.toLowerCase() !== req.walletAddress?.toLowerCase()) {
      const permissions = await db
        .select()
        .from(nfaVaultPermissions)
        .where(and(
          eq(nfaVaultPermissions.nfaId, id),
          eq(nfaVaultPermissions.granteeAddress, req.walletAddress!.toLowerCase())
        ));

      if (permissions.length === 0 || !permissions[0].canExecute) {
        return res.status(403).json({ error: "No execute permission for this agent" });
      }

      // Check expiry
      if (permissions[0].expiresAt && new Date(permissions[0].expiresAt) < new Date()) {
        return res.status(403).json({ error: "Permission has expired" });
      }
    }

    // Log action
    const actionResult = await db.insert(nfaActions).values({
      nfaId: id,
      executorAddress: req.walletAddress!.toLowerCase(),
      actionType: actionType || "EXECUTE",
      actionData: JSON.stringify(actionData),
      txHash,
      status: "PENDING"
    }).returning();

    // Update last action timestamp
    await db
      .update(nfaAgents)
      .set({
        lastActionTimestamp: new Date(),
        lastActiveAt: new Date()
      })
      .where(eq(nfaAgents.id, id));

    res.json({ action: actionResult[0] });
  } catch (error) {
    console.error("Error executing action:", error);
    res.status(500).json({ error: "Failed to execute action" });
  }
});

nfaRouter.get("/agents/:id/actions", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = "50" } = req.query;

    const actions = await db
      .select()
      .from(nfaActions)
      .where(eq(nfaActions.nfaId, id))
      .orderBy(desc(nfaActions.createdAt))
      .limit(parseInt(limit as string));

    res.json({ actions });
  } catch (error) {
    console.error("Error fetching actions:", error);
    res.json({ actions: [] });
  }
});

// ==================== BAP-578 Vault Permissions ====================

nfaRouter.get("/agents/:id/permissions", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const permissions = await db
      .select()
      .from(nfaVaultPermissions)
      .where(eq(nfaVaultPermissions.nfaId, id))
      .orderBy(desc(nfaVaultPermissions.createdAt));

    res.json({ permissions });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    res.json({ permissions: [] });
  }
});

nfaRouter.post("/agents/:id/permissions", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { granteeAddress, permissionLevel, canRead, canWrite, canExecute, canGrant, expiresAt } = req.body;

    // Verify ownership or grant permission
    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, id));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const isOwner = agents[0].ownerAddress.toLowerCase() === req.walletAddress?.toLowerCase();
    
    if (!isOwner) {
      // Check if caller has grant permission
      const callerPerms = await db
        .select()
        .from(nfaVaultPermissions)
        .where(and(
          eq(nfaVaultPermissions.nfaId, id),
          eq(nfaVaultPermissions.granteeAddress, req.walletAddress!.toLowerCase())
        ));

      if (callerPerms.length === 0 || !callerPerms[0].canGrant) {
        return res.status(403).json({ error: "No permission to grant access" });
      }
    }

    // Check if permission already exists
    const existing = await db
      .select()
      .from(nfaVaultPermissions)
      .where(and(
        eq(nfaVaultPermissions.nfaId, id),
        eq(nfaVaultPermissions.granteeAddress, granteeAddress.toLowerCase())
      ));

    let permission;
    if (existing.length > 0) {
      const result = await db
        .update(nfaVaultPermissions)
        .set({
          permissionLevel: permissionLevel || existing[0].permissionLevel,
          canRead: canRead !== undefined ? canRead : existing[0].canRead,
          canWrite: canWrite !== undefined ? canWrite : existing[0].canWrite,
          canExecute: canExecute !== undefined ? canExecute : existing[0].canExecute,
          canGrant: canGrant !== undefined ? canGrant : existing[0].canGrant,
          expiresAt: expiresAt ? new Date(expiresAt) : existing[0].expiresAt,
          updatedAt: new Date()
        })
        .where(eq(nfaVaultPermissions.id, existing[0].id))
        .returning();
      permission = result[0];
    } else {
      const result = await db.insert(nfaVaultPermissions).values({
        nfaId: id,
        granteeAddress: granteeAddress.toLowerCase(),
        permissionLevel: permissionLevel || "VIEWER",
        canRead: canRead || false,
        canWrite: canWrite || false,
        canExecute: canExecute || false,
        canGrant: canGrant || false,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      }).returning();
      permission = result[0];
    }

    res.json({ permission });
  } catch (error) {
    console.error("Error setting permission:", error);
    res.status(500).json({ error: "Failed to set permission" });
  }
});

nfaRouter.delete("/agents/:id/permissions/:granteeAddress", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id, granteeAddress } = req.params;

    // Verify ownership
    const agents = await db.select().from(nfaAgents).where(eq(nfaAgents.id, id));
    if (agents.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    if (agents[0].ownerAddress.toLowerCase() !== req.walletAddress?.toLowerCase()) {
      return res.status(403).json({ error: "Only the owner can revoke permissions" });
    }

    await db
      .delete(nfaVaultPermissions)
      .where(and(
        eq(nfaVaultPermissions.nfaId, id),
        eq(nfaVaultPermissions.granteeAddress, granteeAddress.toLowerCase())
      ));

    res.json({ success: true });
  } catch (error) {
    console.error("Error revoking permission:", error);
    res.status(500).json({ error: "Failed to revoke permission" });
  }
});

// Seed sample NFA agents for marketplace demo (public - no auth required)
nfaRouter.post("/seed-demo-agents", async (_req: Request, res: Response) => {
  try {
    const sampleAgents = [
      { tokenId: 1001, ownerAddress: '0x1234567890123456789012345678901234567890', name: 'Alpha Trading Bot', description: 'Advanced DeFi trading agent with multi-chain arbitrage capabilities and MEV protection.', modelType: 'GPT-4', agentType: 'LEARNING', category: 'defi-trader', systemPrompt: 'You are an expert DeFi trading assistant.', balance: '500000000000000000', learningEnabled: true, interactionCount: 1247 },
      { tokenId: 1002, ownerAddress: '0x2345678901234567890123456789012345678901', name: 'Security Sentinel', description: 'Smart contract auditor and security guardian that monitors for vulnerabilities.', modelType: 'Claude-3', agentType: 'LEARNING', category: 'security-guardian', systemPrompt: 'You are a blockchain security expert.', balance: '250000000000000000', learningEnabled: true, interactionCount: 892 },
      { tokenId: 1003, ownerAddress: '0x3456789012345678901234567890123456789012', name: 'Content Wizard', description: 'AI-powered content creator specializing in Web3 marketing and community engagement.', modelType: 'GPT-4', agentType: 'STATIC', category: 'content-creator', systemPrompt: 'You are a creative content strategist.', balance: '100000000000000000', learningEnabled: false, interactionCount: 567 },
      { tokenId: 1004, ownerAddress: '0x4567890123456789012345678901234567890123', name: 'Data Oracle', description: 'On-chain analytics specialist providing real-time market insights and predictions.', modelType: 'Claude-3', agentType: 'LEARNING', category: 'data-analyst', systemPrompt: 'You are a data analytics expert.', balance: '750000000000000000', learningEnabled: true, interactionCount: 2103 },
      { tokenId: 1005, ownerAddress: '0x5678901234567890123456789012345678901234', name: 'Personal Butler', description: 'Your dedicated Web3 personal assistant for scheduling, reminders, and task management.', modelType: 'GPT-4', agentType: 'STATIC', category: 'personal-assistant', systemPrompt: 'You are a helpful personal assistant.', balance: '50000000000000000', learningEnabled: false, interactionCount: 421 },
      { tokenId: 1006, ownerAddress: '0x6789012345678901234567890123456789012345', name: 'Yield Optimizer', description: 'Automated yield farming agent that finds the best APY opportunities across protocols.', modelType: 'GPT-4', agentType: 'LEARNING', category: 'defi-trader', systemPrompt: 'You are a DeFi yield optimization expert.', balance: '1200000000000000000', learningEnabled: true, interactionCount: 3456 },
      { tokenId: 1007, ownerAddress: '0x7890123456789012345678901234567890123456', name: 'NFT Scout', description: 'Discovers undervalued NFTs and emerging collections before they trend.', modelType: 'Claude-3', agentType: 'STATIC', category: 'data-analyst', systemPrompt: 'You are an NFT market analyst.', balance: '300000000000000000', learningEnabled: false, interactionCount: 789 },
      { tokenId: 1008, ownerAddress: '0x8901234567890123456789012345678901234567', name: 'Community Manager', description: 'Automated Discord and Telegram moderation with engagement analytics.', modelType: 'GPT-4', agentType: 'STATIC', category: 'content-creator', systemPrompt: 'You are a community management expert.', balance: '150000000000000000', learningEnabled: false, interactionCount: 1034 },
      { tokenId: 1009, ownerAddress: '0x9012345678901234567890123456789012345678', name: 'Wallet Guardian', description: 'Real-time transaction monitoring and suspicious activity detection for your wallet.', modelType: 'Claude-3', agentType: 'LEARNING', category: 'security-guardian', systemPrompt: 'You are a wallet security specialist.', balance: '400000000000000000', learningEnabled: true, interactionCount: 1567 },
      { tokenId: 1010, ownerAddress: '0x0123456789012345678901234567890123456789', name: 'Research Companion', description: 'Deep research agent for tokenomics analysis and project due diligence.', modelType: 'GPT-4', agentType: 'LEARNING', category: 'data-analyst', systemPrompt: 'You are a crypto research analyst.', balance: '200000000000000000', learningEnabled: true, interactionCount: 678 },
      { tokenId: 1011, ownerAddress: '0xABCDEF1234567890123456789012345678901234', name: 'Meme Generator', description: 'Creates viral crypto memes and social media content for maximum engagement.', modelType: 'DALL-E', agentType: 'STATIC', category: 'content-creator', systemPrompt: 'You are a meme creation specialist.', balance: '80000000000000000', learningEnabled: false, interactionCount: 2341 },
      { tokenId: 1012, ownerAddress: '0xBCDEF12345678901234567890123456789012345', name: 'Arbitrage Hunter', description: 'Cross-DEX arbitrage detector with lightning-fast execution capabilities.', modelType: 'GPT-4', agentType: 'LEARNING', category: 'defi-trader', systemPrompt: 'You are an arbitrage trading expert.', balance: '900000000000000000', learningEnabled: true, interactionCount: 1823 },
      { tokenId: 1013, ownerAddress: '0xCDEF123456789012345678901234567890123456', name: 'Audit Assistant', description: 'Comprehensive smart contract review and vulnerability assessment agent.', modelType: 'Claude-3', agentType: 'LEARNING', category: 'security-guardian', systemPrompt: 'You are a smart contract auditor.', balance: '350000000000000000', learningEnabled: true, interactionCount: 456 },
      { tokenId: 1014, ownerAddress: '0xDEF1234567890123456789012345678901234567', name: 'Thread Writer', description: 'Crafts engaging Twitter threads about crypto trends and alpha calls.', modelType: 'GPT-4', agentType: 'STATIC', category: 'content-creator', systemPrompt: 'You are a crypto Twitter expert.', balance: '120000000000000000', learningEnabled: false, interactionCount: 934 },
      { tokenId: 1015, ownerAddress: '0xEF12345678901234567890123456789012345678', name: 'Portfolio Tracker', description: 'Real-time portfolio monitoring with PnL tracking and rebalancing suggestions.', modelType: 'GPT-4', agentType: 'LEARNING', category: 'personal-assistant', systemPrompt: 'You are a portfolio management assistant.', balance: '275000000000000000', learningEnabled: true, interactionCount: 1456 },
      { tokenId: 1016, ownerAddress: '0xF123456789012345678901234567890123456789', name: 'Whale Watcher', description: 'Tracks large wallet movements and provides early signals on market moves.', modelType: 'Claude-3', agentType: 'LEARNING', category: 'data-analyst', systemPrompt: 'You are a whale activity analyst.', balance: '600000000000000000', learningEnabled: true, interactionCount: 2789 },
      { tokenId: 1017, ownerAddress: '0x123456789ABCDEF0123456789012345678901234', name: 'Gas Optimizer', description: 'Finds optimal gas prices and suggests best times for on-chain transactions.', modelType: 'GPT-4', agentType: 'STATIC', category: 'defi-trader', systemPrompt: 'You are a gas optimization specialist.', balance: '180000000000000000', learningEnabled: false, interactionCount: 567 },
      { tokenId: 1018, ownerAddress: '0x23456789ABCDEF01234567890123456789012345', name: 'DAO Advisor', description: 'Governance participation assistant for voting strategies and proposal analysis.', modelType: 'Claude-3', agentType: 'LEARNING', category: 'personal-assistant', systemPrompt: 'You are a DAO governance expert.', balance: '450000000000000000', learningEnabled: true, interactionCount: 823 },
      { tokenId: 1019, ownerAddress: '0x3456789ABCDEF012345678901234567890123456', name: 'Airdrop Hunter', description: 'Discovers and tracks airdrop opportunities across multiple chains.', modelType: 'GPT-4', agentType: 'STATIC', category: 'data-analyst', systemPrompt: 'You are an airdrop specialist.', balance: '220000000000000000', learningEnabled: false, interactionCount: 1678 },
      { tokenId: 1020, ownerAddress: '0x456789ABCDEF0123456789012345678901234567', name: 'Bridge Navigator', description: 'Cross-chain bridge assistant for safe and efficient asset transfers.', modelType: 'Claude-3', agentType: 'STATIC', category: 'security-guardian', systemPrompt: 'You are a cross-chain bridge expert.', balance: '160000000000000000', learningEnabled: false, interactionCount: 934 },
    ];

    const prices = ['2.5 BNB', '1.5 BNB', '0.8 BNB', '3.2 BNB', '1.2 BNB'];
    const pricesWei = ['2500000000000000000', '1500000000000000000', '800000000000000000', '3200000000000000000', '1200000000000000000'];

    let created = 0;
    for (const agent of sampleAgents) {
      const existing = await db.select().from(nfaAgents).where(eq(nfaAgents.tokenId, agent.tokenId));
      if (existing.length === 0) {
        const proofOfPrompt = generateProofOfPrompt(agent.systemPrompt, agent.modelType);
        
        const [newAgent] = await db.insert(nfaAgents).values({
          tokenId: agent.tokenId,
          ownerAddress: agent.ownerAddress,
          name: agent.name,
          description: agent.description,
          modelType: agent.modelType,
          agentType: agent.agentType as 'STATIC' | 'LEARNING',
          status: 'ACTIVE',
          proofOfPrompt,
          category: agent.category,
          systemPrompt: agent.systemPrompt,
          balance: agent.balance,
          learningEnabled: agent.learningEnabled,
          interactionCount: agent.interactionCount,
        }).returning();

        if (newAgent) {
          const priceIdx = agent.tokenId % 5;
          await db.insert(nfaListings).values({
            nfaId: newAgent.id,
            sellerAddress: agent.ownerAddress,
            priceWei: pricesWei[priceIdx],
            priceDisplay: prices[priceIdx],
            active: true,
          });

          await db.insert(nfaStats).values({
            nfaId: newAgent.id,
            totalInteractions: agent.interactionCount,
            totalRevenue: (Math.random() * 10).toFixed(2) + ' BNB',
            rating: (3.5 + Math.random() * 1.5).toFixed(1),
            ratingCount: Math.floor(50 + Math.random() * 200),
          });

          created++;
        }
      }
    }

    res.json({ success: true, message: `Seeded ${created} NFA agents (${sampleAgents.length - created} already existed)` });
  } catch (error: any) {
    console.error("Error seeding demo agents:", error);
    res.status(500).json({ error: error.message || "Failed to seed demo agents" });
  }
});
