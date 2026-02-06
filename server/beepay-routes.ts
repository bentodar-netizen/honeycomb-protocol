import { Router, Request, Response } from "express";
import { db } from "./db";
import { 
  beepayIdentities, 
  beepayBudgets, 
  beepayPayments, 
  beepayInvoices, 
  beepayEscrows, 
  beepayEscrowApprovals,
  beepayValidators,
  beepayWebhooks,
  insertBeepayIdentitySchema,
  insertBeepayBudgetSchema,
  insertBeepayPaymentSchema,
  insertBeepayInvoiceSchema,
  insertBeepayEscrowSchema,
  insertBeepayValidatorSchema,
  insertBeepayWebhookSchema
} from "@shared/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { keccak256, toBytes } from "viem";
import crypto from "crypto";

const router = Router();

function generateInvoiceHash(invoice: any): string {
  const data = JSON.stringify({
    seller: invoice.sellerIdentityId,
    buyer: invoice.buyerIdentityId,
    token: invoice.token,
    amount: invoice.amountWei,
    timestamp: Date.now()
  });
  return keccak256(toBytes(data));
}

router.get("/overview", async (req: Request, res: Response) => {
  const { identityId } = req.query;
  
  if (!identityId || typeof identityId !== "string") {
    return res.status(400).json({ error: "identityId required" });
  }
  
  try {
    const [identity] = await db
      .select()
      .from(beepayIdentities)
      .where(eq(beepayIdentities.identityId, identityId));
    
    if (!identity) {
      return res.status(404).json({ error: "Identity not found" });
    }
    
    const budgets = await db
      .select()
      .from(beepayBudgets)
      .where(eq(beepayBudgets.identityId, identityId));
    
    const payments = await db
      .select()
      .from(beepayPayments)
      .where(or(
        eq(beepayPayments.fromIdentityId, identityId),
        eq(beepayPayments.toIdentityId, identityId)
      ))
      .orderBy(desc(beepayPayments.createdAt))
      .limit(10);
    
    const escrows = await db
      .select()
      .from(beepayEscrows)
      .where(or(
        eq(beepayEscrows.payerId, identityId),
        eq(beepayEscrows.payeeId, identityId)
      ));
    
    const pendingInvoices = await db
      .select()
      .from(beepayInvoices)
      .where(and(
        or(
          eq(beepayInvoices.sellerIdentityId, identityId),
          eq(beepayInvoices.buyerIdentityId, identityId)
        ),
        eq(beepayInvoices.status, "pending")
      ));
    
    const activeEscrows = escrows.filter(e => e.status === "funded" || e.status === "created");
    
    let inflow24h = BigInt(0);
    let outflow24h = BigInt(0);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const payment of payments) {
      if (new Date(payment.createdAt) > oneDayAgo) {
        if (payment.toIdentityId === identityId) {
          inflow24h += BigInt(payment.netAmountWei);
        }
        if (payment.fromIdentityId === identityId) {
          outflow24h += BigInt(payment.grossAmountWei);
        }
      }
    }
    
    res.json({
      identity,
      balances: budgets.map(b => ({
        token: b.token,
        balance: b.balanceWei,
        dailyLimit: b.dailyLimitWei,
        dailySpent: b.dailySpentWei,
        isFrozen: b.isFrozen
      })),
      netFlow: {
        inflow24h: inflow24h.toString(),
        outflow24h: outflow24h.toString(),
        net24h: (inflow24h - outflow24h).toString()
      },
      activeEscrowsCount: activeEscrows.length,
      pendingInvoicesCount: pendingInvoices.length,
      recentPayments: payments
    });
  } catch (error) {
    console.error("Error fetching overview:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/identities", async (req: Request, res: Response) => {
  try {
    const validatedData = insertBeepayIdentitySchema.parse(req.body);
    
    const [existing] = await db
      .select()
      .from(beepayIdentities)
      .where(eq(beepayIdentities.identityId, validatedData.identityId));
    
    if (existing) {
      return res.status(409).json({ error: "Identity already exists" });
    }
    
    const [identity] = await db
      .insert(beepayIdentities)
      .values(validatedData)
      .returning();
    
    res.status(201).json(identity);
  } catch (error) {
    console.error("Error creating identity:", error);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/identities/:identityId", async (req: Request, res: Response) => {
  try {
    const [identity] = await db
      .select()
      .from(beepayIdentities)
      .where(eq(beepayIdentities.identityId, req.params.identityId));
    
    if (!identity) {
      return res.status(404).json({ error: "Identity not found" });
    }
    
    res.json(identity);
  } catch (error) {
    console.error("Error fetching identity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/payments", async (req: Request, res: Response) => {
  const { identityId, cursor, limit = "20" } = req.query;
  
  if (!identityId || typeof identityId !== "string") {
    return res.status(400).json({ error: "identityId required" });
  }
  
  try {
    const payments = await db
      .select()
      .from(beepayPayments)
      .where(or(
        eq(beepayPayments.fromIdentityId, identityId),
        eq(beepayPayments.toIdentityId, identityId)
      ))
      .orderBy(desc(beepayPayments.createdAt))
      .limit(parseInt(limit as string));
    
    res.json({ payments });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments", async (req: Request, res: Response) => {
  try {
    const validatedData = insertBeepayPaymentSchema.parse(req.body);
    
    const [payment] = await db
      .insert(beepayPayments)
      .values(validatedData)
      .returning();
    
    res.status(201).json(payment);
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/invoices", async (req: Request, res: Response) => {
  const { identityId } = req.query;
  
  if (!identityId || typeof identityId !== "string") {
    return res.status(400).json({ error: "identityId required" });
  }
  
  try {
    const invoices = await db
      .select()
      .from(beepayInvoices)
      .where(or(
        eq(beepayInvoices.sellerIdentityId, identityId),
        eq(beepayInvoices.buyerIdentityId, identityId)
      ))
      .orderBy(desc(beepayInvoices.createdAt));
    
    res.json({ invoices });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invoices", async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const invoiceHash = generateInvoiceHash(data);
    
    const validatedData = insertBeepayInvoiceSchema.parse({
      ...data,
      invoiceHash
    });
    
    const [invoice] = await db
      .insert(beepayInvoices)
      .values(validatedData)
      .returning();
    
    res.status(201).json({ invoice, invoiceHash });
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/escrows", async (req: Request, res: Response) => {
  const { identityId, status } = req.query;
  
  if (!identityId || typeof identityId !== "string") {
    return res.status(400).json({ error: "identityId required" });
  }
  
  try {
    let query = db
      .select()
      .from(beepayEscrows)
      .where(or(
        eq(beepayEscrows.payerId, identityId),
        eq(beepayEscrows.payeeId, identityId)
      ))
      .orderBy(desc(beepayEscrows.createdAt));
    
    const escrows = await query;
    
    const filteredEscrows = status 
      ? escrows.filter(e => e.status === status)
      : escrows;
    
    res.json({ escrows: filteredEscrows });
  } catch (error) {
    console.error("Error fetching escrows:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/escrows", async (req: Request, res: Response) => {
  try {
    const validatedData = insertBeepayEscrowSchema.parse(req.body);
    
    const [escrow] = await db
      .insert(beepayEscrows)
      .values(validatedData)
      .returning();
    
    res.status(201).json(escrow);
  } catch (error) {
    console.error("Error creating escrow:", error);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/escrows/:escrowId", async (req: Request, res: Response) => {
  try {
    const [escrow] = await db
      .select()
      .from(beepayEscrows)
      .where(eq(beepayEscrows.id, req.params.escrowId));
    
    if (!escrow) {
      return res.status(404).json({ error: "Escrow not found" });
    }
    
    const approvals = await db
      .select()
      .from(beepayEscrowApprovals)
      .where(eq(beepayEscrowApprovals.escrowId, escrow.id));
    
    res.json({ escrow, approvals });
  } catch (error) {
    console.error("Error fetching escrow:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/escrows/:escrowId/approve", async (req: Request, res: Response) => {
  try {
    const { identityId, approvalType, signatureHash, outcomeHash } = req.body;
    
    const [escrow] = await db
      .select()
      .from(beepayEscrows)
      .where(eq(beepayEscrows.id, req.params.escrowId));
    
    if (!escrow) {
      return res.status(404).json({ error: "Escrow not found" });
    }
    
    const [existing] = await db
      .select()
      .from(beepayEscrowApprovals)
      .where(and(
        eq(beepayEscrowApprovals.escrowId, escrow.id),
        eq(beepayEscrowApprovals.identityId, identityId),
        eq(beepayEscrowApprovals.approvalType, approvalType)
      ));
    
    if (existing) {
      return res.status(409).json({ error: "Already approved" });
    }
    
    const [approval] = await db
      .insert(beepayEscrowApprovals)
      .values({
        escrowId: escrow.id,
        identityId,
        approvalType,
        signatureHash,
        outcomeHash
      })
      .returning();
    
    res.status(201).json(approval);
  } catch (error) {
    console.error("Error creating approval:", error);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/validators", async (req: Request, res: Response) => {
  try {
    const validators = await db
      .select()
      .from(beepayValidators)
      .where(eq(beepayValidators.isActive, true))
      .orderBy(desc(beepayValidators.totalEscrowsValidated));
    
    res.json({ validators });
  } catch (error) {
    console.error("Error fetching validators:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/validators", async (req: Request, res: Response) => {
  try {
    const validatedData = insertBeepayValidatorSchema.parse(req.body);
    
    const [validator] = await db
      .insert(beepayValidators)
      .values(validatedData)
      .returning();
    
    res.status(201).json(validator);
  } catch (error) {
    console.error("Error creating validator:", error);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/webhooks", async (req: Request, res: Response) => {
  const { identityId } = req.query;
  
  if (!identityId || typeof identityId !== "string") {
    return res.status(400).json({ error: "identityId required" });
  }
  
  try {
    const webhooks = await db
      .select()
      .from(beepayWebhooks)
      .where(eq(beepayWebhooks.identityId, identityId));
    
    res.json({ webhooks });
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/webhooks", async (req: Request, res: Response) => {
  try {
    const secret = crypto.randomBytes(32).toString("hex");
    const validatedData = insertBeepayWebhookSchema.parse({
      ...req.body,
      secret
    });
    
    const [webhook] = await db
      .insert(beepayWebhooks)
      .values(validatedData)
      .returning();
    
    res.status(201).json(webhook);
  } catch (error) {
    console.error("Error creating webhook:", error);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/webhooks/:webhookId", async (req: Request, res: Response) => {
  try {
    const [deleted] = await db
      .delete(beepayWebhooks)
      .where(eq(beepayWebhooks.id, req.params.webhookId))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: "Webhook not found" });
    }
    
    res.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/budgets", async (req: Request, res: Response) => {
  const { identityId } = req.query;
  
  if (!identityId || typeof identityId !== "string") {
    return res.status(400).json({ error: "identityId required" });
  }
  
  try {
    const budgets = await db
      .select()
      .from(beepayBudgets)
      .where(eq(beepayBudgets.identityId, identityId));
    
    res.json({ budgets });
  } catch (error) {
    console.error("Error fetching budgets:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/budgets", async (req: Request, res: Response) => {
  try {
    const validatedData = insertBeepayBudgetSchema.parse(req.body);
    
    const [budget] = await db
      .insert(beepayBudgets)
      .values(validatedData)
      .returning();
    
    res.status(201).json(budget);
  } catch (error) {
    console.error("Error creating budget:", error);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.patch("/budgets/:identityId/:token", async (req: Request, res: Response) => {
  try {
    const { identityId, token } = req.params;
    const { dailyLimitWei, isFrozen, allowedTargets } = req.body;
    
    const updateData: any = { updatedAt: new Date() };
    if (dailyLimitWei !== undefined) updateData.dailyLimitWei = dailyLimitWei;
    if (isFrozen !== undefined) updateData.isFrozen = isFrozen;
    if (allowedTargets !== undefined) updateData.allowedTargets = allowedTargets;
    
    const [updated] = await db
      .update(beepayBudgets)
      .set(updateData)
      .where(and(
        eq(beepayBudgets.identityId, identityId),
        eq(beepayBudgets.token, token)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "Budget not found" });
    }
    
    res.json(updated);
  } catch (error) {
    console.error("Error updating budget:", error);
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
