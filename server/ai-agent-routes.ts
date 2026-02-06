import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { authMiddleware } from "./auth";
import OpenAI from "openai";
import {
  createAiAgentRequestSchema,
  aiAgentQuoteRequestSchema,
  aiAgentExecuteRequestSchema,
  verifyPaymentRequestSchema,
} from "@shared/schema";
import { db } from "./db";
import { 
  aiAgentProfiles, 
  aiAgentConversations, 
  aiAgentMessages, 
  aiAgentPayments,
  agents 
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Helper function to detect if user wants image generation
function isImageGenerationRequest(
  message: string, 
  systemPrompt: string, 
  conversationHistory: Array<{role: string; content: string}> = []
): boolean {
  const lowerMessage = message.toLowerCase();
  const lowerPrompt = systemPrompt.toLowerCase();
  
  // Check if the system prompt indicates this is an image-generating agent
  const isImageAgent = lowerPrompt.includes("image") || 
                       lowerPrompt.includes("logo") || 
                       lowerPrompt.includes("banner") ||
                       lowerPrompt.includes("visual") ||
                       lowerPrompt.includes("artwork") ||
                       lowerPrompt.includes("design");
  
  // Check if the user message requests an image
  const imageKeywords = [
    "generate", "create", "make", "draw", "design", "produce",
    "image", "logo", "banner", "picture", "artwork", "illustration",
    "icon", "graphic", "visual"
  ];
  
  const hasImageKeyword = imageKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Check if this is a follow-up to an image request (e.g., user selecting an option)
  // Look at recent conversation history
  if (isImageAgent && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-4).map(m => m.content.toLowerCase()).join(" ");
    const historyHasImageContext = imageKeywords.some(keyword => recentHistory.includes(keyword));
    
    // Check for option selection patterns (A, B, 1, 2, yes, etc.)
    const isOptionSelection = /^[ab12]$/i.test(message.trim()) || 
                              /^(yes|yeah|yep|sure|ok|okay|go|proceed)$/i.test(message.trim());
    
    if (historyHasImageContext && isOptionSelection) {
      return true;
    }
  }
  
  // Only trigger image generation if this is an image-focused agent AND user is asking for an image
  return isImageAgent && hasImageKeyword;
}

// Helper function to generate an image using OpenAI
async function generateImage(prompt: string, size: "1024x1024" | "512x512" | "256x256" = "1024x1024"): Promise<string | null> {
  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size,
    });
    
    // Response is in base64 format
    const imageData = response.data[0];
    if (imageData && 'b64_json' in imageData && imageData.b64_json) {
      return `data:image/png;base64,${imageData.b64_json}`;
    }
    return null;
  } catch (error) {
    console.error("Image generation error:", error);
    return null;
  }
}

// Helper to get AI to create an optimized image prompt
async function getOptimizedImagePrompt(userMessage: string, systemPrompt: string, conversationHistory: Array<{role: string; content: string}>): Promise<string> {
  try {
    const promptGeneratorMessages = [
      {
        role: "system" as const,
        content: `You are an expert at creating image generation prompts. Based on the conversation context and the user's request, create a detailed, high-quality image generation prompt. The original system context is: "${systemPrompt.substring(0, 500)}". Output ONLY the image generation prompt, nothing else. Be specific about style, composition, colors, and details.`
      },
      ...conversationHistory.slice(-4).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content
      })),
      {
        role: "user" as const,
        content: `Create an optimized image generation prompt for: "${userMessage}"`
      }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: promptGeneratorMessages,
      max_completion_tokens: 300,
    });

    return completion.choices[0]?.message?.content || userMessage;
  } catch (error) {
    console.error("Error generating optimized prompt:", error);
    return userMessage;
  }
}

export function registerAiAgentRoutes(app: Express) {
  
  // Get all paid AI agents (marketplace)
  app.get("/api/ai-agents", async (_req: Request, res: Response) => {
    try {
      const profiles = await db
        .select({
          profile: aiAgentProfiles,
          agent: agents,
        })
        .from(aiAgentProfiles)
        .innerJoin(agents, eq(aiAgentProfiles.agentId, agents.id))
        .where(eq(aiAgentProfiles.isActive, true))
        .orderBy(desc(aiAgentProfiles.totalInteractions));
      
      res.json({ 
        agents: profiles.map(p => ({
          ...p.profile,
          name: p.agent.name,
          bio: p.agent.bio,
          avatarUrl: p.agent.avatarUrl,
          capabilities: p.agent.capabilities,
        }))
      });
    } catch (error) {
      console.error("Error fetching AI agents:", error);
      res.status(500).json({ error: "Failed to fetch AI agents" });
    }
  });

  // Get a specific paid AI agent
  app.get("/api/ai-agents/:agentId", async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      
      const [result] = await db
        .select({
          profile: aiAgentProfiles,
          agent: agents,
        })
        .from(aiAgentProfiles)
        .innerJoin(agents, eq(aiAgentProfiles.agentId, agents.id))
        .where(eq(aiAgentProfiles.agentId, agentId));
      
      if (!result) {
        return res.status(404).json({ error: "AI agent not found" });
      }
      
      res.json({
        ...result.profile,
        name: result.agent.name,
        bio: result.agent.bio,
        avatarUrl: result.agent.avatarUrl,
        capabilities: result.agent.capabilities,
      });
    } catch (error) {
      console.error("Error fetching AI agent:", error);
      res.status(500).json({ error: "Failed to fetch AI agent" });
    }
  });

  // Create a paid AI agent (requires auth)
  app.post("/api/ai-agents", authMiddleware, async (req: Request, res: Response) => {
    try {
      const walletAddress = req.walletAddress;
      if (!walletAddress) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Get the agent by wallet address
      const agent = await storage.getAgentByAddress(walletAddress);
      if (!agent) {
        return res.status(404).json({ error: "You need to register as a Bee first" });
      }

      const parsed = createAiAgentRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const { name, bio, avatarUrl, capabilities, systemPrompt, pricingModel, pricePerUnit } = parsed.data;

      // Check if agent already has a paid AI profile
      const existing = await db
        .select()
        .from(aiAgentProfiles)
        .where(eq(aiAgentProfiles.agentId, agent.id));
      
      if (existing.length > 0) {
        return res.status(400).json({ error: "You already have a paid AI agent. Use the update endpoint to modify it." });
      }

      // Update the base agent profile if needed
      const updates: any = {};
      if (name && name !== agent.name) updates.name = name;
      if (bio !== undefined) updates.bio = bio;
      if (avatarUrl) updates.avatarUrl = avatarUrl;
      if (capabilities) updates.capabilities = capabilities;
      
      if (Object.keys(updates).length > 0) {
        await storage.updateAgentProfile(agent.id, updates);
      }

      // Enable bot mode if not already
      if (!agent.isBot) {
        await storage.updateAgentIsBot(agent.id, true);
      }

      // Create the AI agent profile
      const [profile] = await db
        .insert(aiAgentProfiles)
        .values({
          agentId: agent.id,
          systemPrompt,
          pricingModel,
          pricePerUnit,
          creatorAddress: agent.ownerAddress,
        })
        .returning();

      res.status(201).json({ 
        message: "Paid AI agent created successfully",
        profile 
      });
    } catch (error) {
      console.error("Error creating AI agent:", error);
      res.status(500).json({ error: "Failed to create AI agent" });
    }
  });

  // Update a paid AI agent (requires auth)
  app.patch("/api/ai-agents/:agentId", authMiddleware, async (req: Request, res: Response) => {
    try {
      const agent = (req as any).agent;
      const { agentId } = req.params;
      
      if (!agent || agent.id !== agentId) {
        return res.status(403).json({ error: "You can only update your own AI agent" });
      }

      const { systemPrompt, pricingModel, pricePerUnit, isActive, name, bio, avatarUrl, capabilities } = req.body;

      // Update base agent profile
      const baseUpdates: any = {};
      if (name) baseUpdates.name = name;
      if (bio !== undefined) baseUpdates.bio = bio;
      if (avatarUrl) baseUpdates.avatarUrl = avatarUrl;
      if (capabilities) baseUpdates.capabilities = capabilities;
      
      if (Object.keys(baseUpdates).length > 0) {
        await storage.updateAgentProfile(agent.id, baseUpdates);
      }

      // Update AI agent profile
      const profileUpdates: any = {};
      if (systemPrompt) profileUpdates.systemPrompt = systemPrompt;
      if (pricingModel) profileUpdates.pricingModel = pricingModel;
      if (pricePerUnit) profileUpdates.pricePerUnit = pricePerUnit;
      if (typeof isActive === 'boolean') profileUpdates.isActive = isActive;

      if (Object.keys(profileUpdates).length > 0) {
        await db
          .update(aiAgentProfiles)
          .set(profileUpdates)
          .where(eq(aiAgentProfiles.agentId, agentId));
      }

      res.json({ message: "AI agent updated successfully" });
    } catch (error) {
      console.error("Error updating AI agent:", error);
      res.status(500).json({ error: "Failed to update AI agent" });
    }
  });

  // Get quote for interacting with an AI agent
  app.post("/api/ai-agents/:agentId/quote", async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const parsed = aiAgentQuoteRequestSchema.safeParse({ ...req.body, agentId });
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const [result] = await db
        .select()
        .from(aiAgentProfiles)
        .where(eq(aiAgentProfiles.agentId, agentId));
      
      if (!result) {
        return res.status(404).json({ error: "AI agent not found" });
      }

      if (!result.isActive) {
        return res.status(400).json({ error: "AI agent is not accepting requests" });
      }

      const { estimatedUnits } = parsed.data;
      let totalPrice = result.pricePerUnit;
      let units = 1;

      if (result.pricingModel === 'per_token' && estimatedUnits) {
        units = estimatedUnits;
        totalPrice = (BigInt(result.pricePerUnit) * BigInt(units)).toString();
      } else if (result.pricingModel === 'per_task' && estimatedUnits) {
        units = estimatedUnits;
        totalPrice = (BigInt(result.pricePerUnit) * BigInt(units)).toString();
      }

      res.json({
        agentId,
        pricingModel: result.pricingModel,
        pricePerUnit: result.pricePerUnit,
        estimatedUnits: units,
        totalPrice,
        creatorAddress: result.creatorAddress,
      });
    } catch (error) {
      console.error("Error getting quote:", error);
      res.status(500).json({ error: "Failed to get quote" });
    }
  });

  // Verify payment and execute AI agent interaction
  app.post("/api/ai-agents/:agentId/execute", async (req: Request, res: Response) => {
    try {
      // Check if OpenAI is configured
      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY || !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
        return res.status(503).json({ error: "AI service is not configured. Please contact the platform administrator." });
      }

      const { agentId } = req.params;
      const parsed = aiAgentExecuteRequestSchema.safeParse({ ...req.body, agentId });
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const { message, conversationId, paymentTxHash } = parsed.data;

      // Get the AI agent profile
      const [profile] = await db
        .select({
          profile: aiAgentProfiles,
          agent: agents,
        })
        .from(aiAgentProfiles)
        .innerJoin(agents, eq(aiAgentProfiles.agentId, agents.id))
        .where(eq(aiAgentProfiles.agentId, agentId));

      if (!profile) {
        return res.status(404).json({ error: "AI agent not found" });
      }

      if (!profile.profile.isActive) {
        return res.status(400).json({ error: "AI agent is not accepting requests" });
      }

      // Check if payment tx has already been used (anti-replay protection)
      const existingPayment = await db
        .select()
        .from(aiAgentPayments)
        .where(eq(aiAgentPayments.txHash, paymentTxHash));

      if (existingPayment.length > 0 && existingPayment[0].isUsed) {
        return res.status(400).json({ error: "Payment transaction has already been used" });
      }

      // Record the payment if not already recorded
      let payment = existingPayment[0];
      if (!payment) {
        // In production, verify the transaction on-chain here
        // For now, we trust the tx hash and record it
        [payment] = await db
          .insert(aiAgentPayments)
          .values({
            aiAgentProfileId: profile.profile.id,
            userAddress: req.body.userAddress || "0x0000000000000000000000000000000000000000",
            txHash: paymentTxHash,
            amountPaid: profile.profile.pricePerUnit,
            pricingModel: profile.profile.pricingModel,
          })
          .returning();
      }

      // Get or create conversation
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        const [newConv] = await db
          .insert(aiAgentConversations)
          .values({
            aiAgentProfileId: profile.profile.id,
            userAddress: req.body.userAddress || "0x0000000000000000000000000000000000000000",
            title: message.substring(0, 50) + (message.length > 50 ? "..." : ""),
          })
          .returning();
        currentConversationId = newConv.id;
      }

      // Get conversation history
      const history = await db
        .select()
        .from(aiAgentMessages)
        .where(eq(aiAgentMessages.conversationId, currentConversationId))
        .orderBy(aiAgentMessages.createdAt);

      // Build messages for OpenAI
      const systemMessage = {
        role: "system" as const,
        content: profile.profile.systemPrompt,
      };

      const historyMessages = history.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const userMessage = {
        role: "user" as const,
        content: message,
      };

      let assistantResponse: string;
      let tokenCount = 0;
      let generatedImageUrl: string | null = null;

      // Check if this is an image generation request
      const shouldGenerateImage = isImageGenerationRequest(message, profile.profile.systemPrompt, historyMessages);

      if (shouldGenerateImage) {
        // Get an optimized image prompt from the AI
        const optimizedPrompt = await getOptimizedImagePrompt(
          message, 
          profile.profile.systemPrompt,
          historyMessages
        );
        
        console.log("Generating image with prompt:", optimizedPrompt);
        
        // Generate the actual image
        generatedImageUrl = await generateImage(optimizedPrompt);
        
        if (generatedImageUrl) {
          // Create a response with the image
          assistantResponse = `Here's the image I created for you:\n\n![Generated Image](${generatedImageUrl})\n\n*Prompt used: "${optimizedPrompt.substring(0, 100)}..."*`;
          tokenCount = 100; // Approximate token count for image generation
        } else {
          // Image generation failed, fall back to text response
          const completion = await openai.chat.completions.create({
            model: "gpt-5.2",
            messages: [systemMessage, ...historyMessages, userMessage],
            max_completion_tokens: 2048,
          });
          assistantResponse = (completion.choices[0]?.message?.content || "I apologize, I couldn't generate an image at this time. Please try again later.");
          tokenCount = completion.usage?.total_tokens || 0;
        }
      } else {
        // Regular text chat - Call OpenAI
        const completion = await openai.chat.completions.create({
          model: "gpt-5.2",
          messages: [systemMessage, ...historyMessages, userMessage],
          max_completion_tokens: 2048,
        });

        assistantResponse = completion.choices[0]?.message?.content || "I apologize, I couldn't generate a response.";
        tokenCount = completion.usage?.total_tokens || 0;
      }

      // Save user message
      await db.insert(aiAgentMessages).values({
        conversationId: currentConversationId,
        role: "user",
        content: message,
        tokenCount: 0,
      });

      // Save assistant message
      await db.insert(aiAgentMessages).values({
        conversationId: currentConversationId,
        role: "assistant",
        content: assistantResponse,
        tokenCount,
        paymentTxHash,
        pricePaid: profile.profile.pricePerUnit,
      });

      // Mark payment as used
      await db
        .update(aiAgentPayments)
        .set({ isUsed: true, unitsUsed: 1 })
        .where(eq(aiAgentPayments.id, payment.id));

      // Update agent stats
      await db
        .update(aiAgentProfiles)
        .set({
          totalInteractions: profile.profile.totalInteractions + 1,
          totalEarnings: (BigInt(profile.profile.totalEarnings) + BigInt(profile.profile.pricePerUnit)).toString(),
        })
        .where(eq(aiAgentProfiles.id, profile.profile.id));

      res.json({
        conversationId: currentConversationId,
        response: assistantResponse,
        tokenCount,
        pricePaid: profile.profile.pricePerUnit,
        ...(generatedImageUrl && { imageUrl: generatedImageUrl }),
      });
    } catch (error) {
      console.error("Error executing AI agent:", error);
      res.status(500).json({ error: "Failed to execute AI agent request" });
    }
  });

  // Get user's conversations with an AI agent
  app.get("/api/ai-agents/:agentId/conversations", async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const userAddress = req.query.userAddress as string;

      if (!userAddress) {
        return res.status(400).json({ error: "userAddress query parameter required" });
      }

      const [profile] = await db
        .select()
        .from(aiAgentProfiles)
        .where(eq(aiAgentProfiles.agentId, agentId));

      if (!profile) {
        return res.status(404).json({ error: "AI agent not found" });
      }

      const conversations = await db
        .select()
        .from(aiAgentConversations)
        .where(
          and(
            eq(aiAgentConversations.aiAgentProfileId, profile.id),
            eq(aiAgentConversations.userAddress, userAddress)
          )
        )
        .orderBy(desc(aiAgentConversations.updatedAt));

      res.json({ conversations });
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get messages in a conversation
  app.get("/api/ai-agents/conversations/:conversationId/messages", async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;

      const messages = await db
        .select()
        .from(aiAgentMessages)
        .where(eq(aiAgentMessages.conversationId, conversationId))
        .orderBy(aiAgentMessages.createdAt);

      res.json({ messages });
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Get creator's earnings and stats
  app.get("/api/ai-agents/:agentId/stats", authMiddleware, async (req: Request, res: Response) => {
    try {
      const agent = (req as any).agent;
      const { agentId } = req.params;

      if (!agent || agent.id !== agentId) {
        return res.status(403).json({ error: "You can only view stats for your own AI agent" });
      }

      const [profile] = await db
        .select()
        .from(aiAgentProfiles)
        .where(eq(aiAgentProfiles.agentId, agentId));

      if (!profile) {
        return res.status(404).json({ error: "AI agent profile not found" });
      }

      // Get recent payments
      const recentPayments = await db
        .select()
        .from(aiAgentPayments)
        .where(eq(aiAgentPayments.aiAgentProfileId, profile.id))
        .orderBy(desc(aiAgentPayments.createdAt))
        .limit(20);

      res.json({
        totalInteractions: profile.totalInteractions,
        totalEarnings: profile.totalEarnings,
        isActive: profile.isActive,
        pricingModel: profile.pricingModel,
        pricePerUnit: profile.pricePerUnit,
        recentPayments,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Verify payment on-chain (for frontend to call before execute)
  app.post("/api/ai-agents/verify-payment", async (req: Request, res: Response) => {
    try {
      const parsed = verifyPaymentRequestSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const { txHash, agentId } = parsed.data;

      // Check if tx has already been used
      const existing = await db
        .select()
        .from(aiAgentPayments)
        .where(eq(aiAgentPayments.txHash, txHash));

      if (existing.length > 0) {
        return res.json({
          verified: !existing[0].isUsed,
          alreadyUsed: existing[0].isUsed,
          message: existing[0].isUsed ? "Payment already used" : "Payment available",
        });
      }

      // In production, verify the transaction on BNB Chain here
      // For now, return that it's valid (verification would happen on execute)
      res.json({
        verified: true,
        alreadyUsed: false,
        message: "Payment appears valid. Execute to confirm.",
      });
    } catch (error) {
      console.error("Error verifying payment:", error);
      res.status(500).json({ error: "Failed to verify payment" });
    }
  });
}
