import jwt from "jsonwebtoken";
import { verifyMessage } from "viem";
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const JWT_SECRET = process.env.SESSION_SECRET || "honeycomb-secret-key";
const JWT_EXPIRY = "24h";

export interface JwtPayload {
  address: string;
  iat: number;
  exp: number;
}

// Bot API key generation
export function generateApiKey(): string {
  return `hcb_${crypto.randomBytes(32).toString("hex")}`;
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

export function generateToken(address: string): string {
  return jwt.sign({ address: address.toLowerCase() }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function verifyWalletSignature(
  address: string,
  message: string,
  signature: `0x${string}`
): Promise<boolean> {
  try {
    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature,
    });
    return isValid;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

export function generateNonce(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

declare global {
  namespace Express {
    interface Request {
      walletAddress?: string;
      agentId?: string;
      isBot?: boolean;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization required" });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  req.walletAddress = payload.address;
  next();
}

export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    if (payload) {
      req.walletAddress = payload.address;
    }
  }
  next();
}

// Bot rate limiting - simple in-memory store
const botRequestCounts = new Map<string, { count: number; resetAt: number }>();
const BOT_RATE_LIMIT = 60; // requests per minute
const BOT_RATE_WINDOW = 60 * 1000; // 1 minute in ms

export function checkBotRateLimit(agentId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = botRequestCounts.get(agentId);
  
  if (!record || now > record.resetAt) {
    botRequestCounts.set(agentId, { count: 1, resetAt: now + BOT_RATE_WINDOW });
    return { allowed: true, remaining: BOT_RATE_LIMIT - 1, resetAt: now + BOT_RATE_WINDOW };
  }
  
  if (record.count >= BOT_RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }
  
  record.count++;
  return { allowed: true, remaining: BOT_RATE_LIMIT - record.count, resetAt: record.resetAt };
}

// Create bot auth middleware factory that takes storage
export function createBotAuthMiddleware(storage: { getAgentByApiKey: (hashedKey: string) => Promise<any> }) {
  return async function botAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers["x-api-key"] as string;
    
    if (!apiKey || !apiKey.startsWith("hcb_")) {
      return res.status(401).json({ message: "Invalid API key format" });
    }
    
    const hashedKey = hashApiKey(apiKey);
    const agent = await storage.getAgentByApiKey(hashedKey);
    
    if (!agent) {
      return res.status(401).json({ message: "Invalid API key" });
    }
    
    if (!agent.isBot) {
      return res.status(403).json({ message: "API key access requires bot account" });
    }
    
    // Check rate limit
    const rateLimit = checkBotRateLimit(agent.id);
    
    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", BOT_RATE_LIMIT.toString());
    res.setHeader("X-RateLimit-Remaining", rateLimit.remaining.toString());
    res.setHeader("X-RateLimit-Reset", Math.ceil(rateLimit.resetAt / 1000).toString());
    
    if (!rateLimit.allowed) {
      return res.status(429).json({ message: "Rate limit exceeded. Max 60 requests per minute." });
    }
    
    req.agentId = agent.id;
    req.walletAddress = agent.ownerAddress;
    req.isBot = true;
    next();
  };
}
