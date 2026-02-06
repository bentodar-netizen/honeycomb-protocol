import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, unique, bigint, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Auth nonces for wallet signature authentication
export const authNonces = pgTable("auth_nonces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  address: text("address").notNull(),
  nonce: text("nonce").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  used: boolean("used").default(false).notNull(),
});

// Agents (Bees) - users registered on the platform
export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerAddress: text("owner_address").notNull(),
  name: text("name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  twitterHandle: text("twitter_handle"),
  capabilities: text("capabilities").array().default(sql`ARRAY[]::text[]`),
  metadataCid: text("metadata_cid"),
  onChainId: integer("on_chain_id"),
  isBot: boolean("is_bot").default(false).notNull(),
  apiKey: text("api_key"),
  apiKeyCreatedAt: timestamp("api_key_created_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Posts (Cells) - content shared on the platform
export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  channelId: varchar("channel_id"), // References channels.id (validated at application level)
  title: text("title").notNull(),
  body: text("body").notNull(),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  contentCid: text("content_cid"),
  onChainId: integer("on_chain_id"),
  upvotes: integer("upvotes").default(0).notNull(),
  downvotes: integer("downvotes").default(0).notNull(),
  commentCount: integer("comment_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Comments on posts
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => posts.id),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Votes on posts (one vote per agent per post)
export const votes = pgTable("votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => posts.id),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  direction: text("direction").notNull(), // "up" or "down"
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueVote: unique().on(table.postId, table.agentId),
}));

// Bounties (Honey) - tasks with rewards
export const bounties = pgTable("bounties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  rewardAmount: text("reward_amount").notNull(), // Amount in wei as string
  rewardDisplay: text("reward_display").notNull(), // Human readable "0.01 BNB"
  deadline: timestamp("deadline").notNull(),
  status: text("status").notNull().default("open"), // open, awarded, cancelled, expired
  solutionCount: integer("solution_count").default(0).notNull(),
  winningSolutionId: varchar("winning_solution_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Solutions to bounties
export const solutions = pgTable("solutions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bountyId: varchar("bounty_id").notNull().references(() => bounties.id),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  body: text("body").notNull(),
  attachments: text("attachments").array().default(sql`ARRAY[]::text[]`),
  isWinner: boolean("is_winner").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueSolution: unique().on(table.bountyId, table.agentId),
}));

// Launchpad tokens
export const launchTokens = pgTable("launch_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenAddress: text("token_address").notNull().unique(),
  creatorAddress: text("creator_address").notNull(),
  creatorBeeId: varchar("creator_bee_id").references(() => agents.id),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  metadataCID: text("metadata_cid").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  graduated: boolean("graduated").default(false).notNull(),
  totalRaisedNative: text("total_raised_native").default("0").notNull(),
  tradeCount: integer("trade_count").default(0).notNull(),
  migrated: boolean("migrated").default(false).notNull(),
  pairAddress: text("pair_address"),
  lpAmount: text("lp_amount"),
  lpLockAddress: text("lp_lock_address"),
  migrationTxHash: text("migration_tx_hash"),
  migratedAt: timestamp("migrated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Market data fields for real-time display
  currentPrice: text("current_price").default("0"),
  marketCapNative: text("market_cap_native").default("0"),
  volume24h: text("volume_24h").default("0"),
  priceChange24h: real("price_change_24h").default(0),
  holderCount: integer("holder_count").default(0),
  lastTradeAt: timestamp("last_trade_at"),
});

// Launch activity feed for real-time updates
export const launchActivity = pgTable("launch_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'launch', 'buy', 'sell', 'graduate', 'migrate'
  tokenAddress: text("token_address").notNull(),
  tokenName: text("token_name").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  tokenImage: text("token_image"),
  actorAddress: text("actor_address").notNull(),
  actorName: text("actor_name"),
  nativeAmount: text("native_amount"),
  tokenAmount: text("token_amount"),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Token comments
export const launchComments = pgTable("launch_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenAddress: text("token_address").notNull(),
  agentId: varchar("agent_id").references(() => agents.id),
  walletAddress: text("wallet_address").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Launchpad trades
export const launchTrades = pgTable("launch_trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenAddress: text("token_address").notNull(),
  trader: text("trader").notNull(),
  isBuy: boolean("is_buy").notNull(),
  nativeAmount: text("native_amount").notNull(),
  tokenAmount: text("token_amount").notNull(),
  feeNative: text("fee_native").notNull(),
  priceAfter: text("price_after").notNull(),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ HIVE FEATURES ============

// Channels (Topics/Communities) - like subreddits
export const channels = pgTable("channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  iconUrl: text("icon_url"),
  bannerUrl: text("banner_url"),
  creatorId: varchar("creator_id").references(() => agents.id),
  memberCount: integer("member_count").default(0).notNull(),
  postCount: integer("post_count").default(0).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Channel memberships
export const channelMembers = pgTable("channel_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().references(() => channels.id),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  role: text("role").default("member").notNull(), // member, moderator, admin
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueMember: unique().on(table.channelId, table.agentId),
}));

// Bot follows (bot-to-bot following)
export const botFollows = pgTable("bot_follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").notNull().references(() => agents.id),
  followingId: varchar("following_id").notNull().references(() => agents.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueFollow: unique().on(table.followerId, table.followingId),
}));

// Bot persistent memory
export const botMemory = pgTable("bot_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  memoryKey: text("memory_key").notNull(),
  memoryValue: text("memory_value").notNull(),
  category: text("category").default("general").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueMemory: unique().on(table.agentId, table.memoryKey),
}));

// Bot webhooks for notifications
export const botWebhooks = pgTable("bot_webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").array().default(sql`ARRAY['mention', 'reply', 'follow']::text[]`),
  isActive: boolean("is_active").default(true).notNull(),
  lastDeliveryAt: timestamp("last_delivery_at"),
  failureCount: integer("failure_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bot skills (capabilities that can be shared)
export const botSkills = pgTable("bot_skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").default("general").notNull(),
  endpointUrl: text("endpoint_url"),
  inputSchema: text("input_schema"), // JSON schema
  outputSchema: text("output_schema"), // JSON schema
  usageCount: integer("usage_count").default(0).notNull(),
  isPublic: boolean("is_public").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Agent verification status
export const agentVerifications = pgTable("agent_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id).unique(),
  verificationType: text("verification_type").notNull(), // twitter, github, website
  verificationData: text("verification_data"), // handle/username/domain
  verifiedAt: timestamp("verified_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// AI Chat conversations for bot auto-replies
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => agents.id),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Chat messages
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  role: text("role").notNull(), // user, assistant, system
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Paid AI Agent Profiles - extends agents with monetization capabilities
export const aiAgentProfiles = pgTable("ai_agent_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id).unique(),
  systemPrompt: text("system_prompt").notNull(),
  pricingModel: text("pricing_model").notNull(), // per_message, per_token, per_task
  pricePerUnit: text("price_per_unit").notNull(), // Wei amount as string
  creatorAddress: text("creator_address").notNull(),
  onChainRegistryId: integer("on_chain_registry_id"),
  isActive: boolean("is_active").default(true).notNull(),
  totalInteractions: integer("total_interactions").default(0).notNull(),
  totalEarnings: text("total_earnings").default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Agent user conversations - tracks user chats with paid agents
export const aiAgentConversations = pgTable("ai_agent_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  aiAgentProfileId: varchar("ai_agent_profile_id").notNull().references(() => aiAgentProfiles.id),
  userAddress: text("user_address").notNull(),
  title: text("title"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Agent conversation messages
export const aiAgentMessages = pgTable("ai_agent_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => aiAgentConversations.id),
  role: text("role").notNull(), // user, assistant
  content: text("content").notNull(),
  tokenCount: integer("token_count").default(0).notNull(),
  paymentTxHash: text("payment_tx_hash"), // Payment transaction hash for this message
  pricePaid: text("price_paid"), // Wei amount paid for this message
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Agent payment verifications - tracks on-chain payment verification
export const aiAgentPayments = pgTable("ai_agent_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  aiAgentProfileId: varchar("ai_agent_profile_id").notNull().references(() => aiAgentProfiles.id),
  userAddress: text("user_address").notNull(),
  txHash: text("tx_hash").notNull().unique(),
  amountPaid: text("amount_paid").notNull(), // Wei amount
  pricingModel: text("pricing_model").notNull(),
  unitsUsed: integer("units_used").default(0).notNull(), // messages, tokens, or tasks
  isUsed: boolean("is_used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertAuthNonceSchema = createInsertSchema(authNonces).pick({
  address: true,
  nonce: true,
});

export const insertAgentSchema = createInsertSchema(agents).pick({
  ownerAddress: true,
  name: true,
  bio: true,
  avatarUrl: true,
  capabilities: true,
});

export const insertPostSchema = createInsertSchema(posts).pick({
  agentId: true,
  channelId: true,
  title: true,
  body: true,
  tags: true,
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  postId: true,
  agentId: true,
  body: true,
});

export const insertVoteSchema = createInsertSchema(votes).pick({
  postId: true,
  agentId: true,
  direction: true,
});

export const insertBountySchema = createInsertSchema(bounties).pick({
  agentId: true,
  title: true,
  body: true,
  tags: true,
  rewardAmount: true,
  rewardDisplay: true,
  deadline: true,
});

export const insertSolutionSchema = createInsertSchema(solutions).pick({
  bountyId: true,
  agentId: true,
  body: true,
  attachments: true,
});

export const insertLaunchTokenSchema = createInsertSchema(launchTokens).omit({
  id: true,
  createdAt: true,
});

export const insertLaunchActivitySchema = createInsertSchema(launchActivity).omit({
  id: true,
  createdAt: true,
});

export const insertLaunchCommentSchema = createInsertSchema(launchComments).omit({
  id: true,
  createdAt: true,
});

export const insertLaunchTradeSchema = createInsertSchema(launchTrades).pick({
  tokenAddress: true,
  trader: true,
  isBuy: true,
  nativeAmount: true,
  tokenAmount: true,
  feeNative: true,
  priceAfter: true,
  txHash: true,
});

// Hive feature insert schemas
export const insertChannelSchema = createInsertSchema(channels).pick({
  name: true,
  slug: true,
  description: true,
  iconUrl: true,
  bannerUrl: true,
  creatorId: true,
});

export const insertChannelMemberSchema = createInsertSchema(channelMembers).pick({
  channelId: true,
  agentId: true,
  role: true,
});

export const insertBotFollowSchema = createInsertSchema(botFollows).pick({
  followerId: true,
  followingId: true,
});

export const insertBotMemorySchema = createInsertSchema(botMemory).pick({
  agentId: true,
  memoryKey: true,
  memoryValue: true,
  category: true,
});

export const insertBotWebhookSchema = createInsertSchema(botWebhooks).pick({
  agentId: true,
  url: true,
  secret: true,
  events: true,
});

export const insertBotSkillSchema = createInsertSchema(botSkills).pick({
  agentId: true,
  name: true,
  description: true,
  category: true,
  endpointUrl: true,
  inputSchema: true,
  outputSchema: true,
  isPublic: true,
});

export const insertAgentVerificationSchema = createInsertSchema(agentVerifications).pick({
  agentId: true,
  verificationType: true,
  verificationData: true,
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  agentId: true,
  title: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  role: true,
  content: true,
});

// Paid AI Agent insert schemas
export const insertAiAgentProfileSchema = createInsertSchema(aiAgentProfiles).pick({
  agentId: true,
  systemPrompt: true,
  pricingModel: true,
  pricePerUnit: true,
  creatorAddress: true,
});

export const insertAiAgentConversationSchema = createInsertSchema(aiAgentConversations).pick({
  aiAgentProfileId: true,
  userAddress: true,
  title: true,
});

export const insertAiAgentMessageSchema = createInsertSchema(aiAgentMessages).pick({
  conversationId: true,
  role: true,
  content: true,
  tokenCount: true,
  paymentTxHash: true,
  pricePaid: true,
});

export const insertAiAgentPaymentSchema = createInsertSchema(aiAgentPayments).pick({
  aiAgentProfileId: true,
  userAddress: true,
  txHash: true,
  amountPaid: true,
  pricingModel: true,
});

// Types
export type AuthNonce = typeof authNonces.$inferSelect;
export type InsertAuthNonce = z.infer<typeof insertAuthNonceSchema>;

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;

export type Bounty = typeof bounties.$inferSelect;
export type InsertBounty = z.infer<typeof insertBountySchema>;

export type Solution = typeof solutions.$inferSelect;
export type InsertSolution = z.infer<typeof insertSolutionSchema>;

export type LaunchToken = typeof launchTokens.$inferSelect;
export type InsertLaunchToken = z.infer<typeof insertLaunchTokenSchema>;

export type LaunchTrade = typeof launchTrades.$inferSelect;
export type InsertLaunchTrade = z.infer<typeof insertLaunchTradeSchema>;

export type LaunchActivity = typeof launchActivity.$inferSelect;
export type InsertLaunchActivity = z.infer<typeof insertLaunchActivitySchema>;

export type LaunchComment = typeof launchComments.$inferSelect;
export type InsertLaunchComment = z.infer<typeof insertLaunchCommentSchema>;

// Hive feature types
export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;

export type ChannelMember = typeof channelMembers.$inferSelect;
export type InsertChannelMember = z.infer<typeof insertChannelMemberSchema>;

export type BotFollow = typeof botFollows.$inferSelect;
export type InsertBotFollow = z.infer<typeof insertBotFollowSchema>;

export type BotMemory = typeof botMemory.$inferSelect;
export type InsertBotMemory = z.infer<typeof insertBotMemorySchema>;

export type BotWebhook = typeof botWebhooks.$inferSelect;
export type InsertBotWebhook = z.infer<typeof insertBotWebhookSchema>;

export type BotSkill = typeof botSkills.$inferSelect;
export type InsertBotSkill = z.infer<typeof insertBotSkillSchema>;

export type AgentVerification = typeof agentVerifications.$inferSelect;
export type InsertAgentVerification = z.infer<typeof insertAgentVerificationSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Paid AI Agent types
export type AiAgentProfile = typeof aiAgentProfiles.$inferSelect;
export type InsertAiAgentProfile = z.infer<typeof insertAiAgentProfileSchema>;

export type AiAgentConversation = typeof aiAgentConversations.$inferSelect;
export type InsertAiAgentConversation = z.infer<typeof insertAiAgentConversationSchema>;

export type AiAgentMessage = typeof aiAgentMessages.$inferSelect;
export type InsertAiAgentMessage = z.infer<typeof insertAiAgentMessageSchema>;

export type AiAgentPayment = typeof aiAgentPayments.$inferSelect;
export type InsertAiAgentPayment = z.infer<typeof insertAiAgentPaymentSchema>;

// ============ PREDICTION DUELS ============

// Prediction duels - 1v1 price prediction game
export const duels = pgTable("duels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  onChainDuelId: bigint("on_chain_duel_id", { mode: "bigint" }), // On-chain contract duel ID (null if database-only)
  createTxHash: text("create_tx_hash"), // Transaction hash for on-chain creation
  duelType: text("duel_type").notNull().default("price"), // "price" or "random" (VRF)
  assetId: text("asset_id").notNull(), // e.g., "BNB", "BTC", "ETH"
  assetName: text("asset_name").notNull(), // e.g., "Binance Coin"
  durationSec: integer("duration_sec").notNull(), // 30, 60, or 300
  stakeWei: text("stake_wei").notNull(), // Equal stake amount in wei
  stakeDisplay: text("stake_display").notNull(), // Human readable "0.01 BNB"
  creatorAddress: text("creator_address").notNull(),
  creatorAgentId: varchar("creator_agent_id").references(() => agents.id),
  creatorOnChainAgentId: bigint("creator_on_chain_agent_id", { mode: "bigint" }), // On-chain agent ID
  joinerAddress: text("joiner_address"),
  joinerAgentId: varchar("joiner_agent_id").references(() => agents.id),
  joinerOnChainAgentId: bigint("joiner_on_chain_agent_id", { mode: "bigint" }), // On-chain agent ID
  creatorDirection: text("creator_direction").notNull(), // "up" or "down"
  joinerDirection: text("joiner_direction"),
  startPrice: text("start_price"), // Price at duel start (8 decimals)
  endPrice: text("end_price"), // Price at duel end
  startTs: timestamp("start_ts"), // When duel became LIVE
  endTs: timestamp("end_ts"), // When duel ends
  status: text("status").notNull().default("open"), // open, live, settled, cancelled, expired
  winnerAddress: text("winner_address"),
  payoutWei: text("payout_wei"), // 90% of pot to winner
  feeWei: text("fee_wei"), // 10% platform fee
  joinTxHash: text("join_tx_hash"), // Transaction hash for on-chain join
  settlementTxHash: text("settlement_tx_hash"),
  vrfRequestId: text("vrf_request_id"), // VRF request ID for random duels
  vrfRandomWord: text("vrf_random_word"), // VRF random word result
  isAutoJoin: boolean("is_auto_join").default(false), // Whether HouseBot can auto-join
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Duel assets - supported assets for prediction
export const duelAssets = pgTable("duel_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: text("asset_id").notNull().unique(), // "BNB", "BTC", etc.
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  iconUrl: text("icon_url"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ TWITTER AUTOMATION ============

// Twitter bot scheduled tweets
export const twitterTweets = pgTable("twitter_tweets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  content: text("content").notNull(),
  tweetId: text("tweet_id"), // Twitter's tweet ID after posting
  status: text("status").notNull().default("pending"), // pending, posted, failed
  scheduledAt: timestamp("scheduled_at"),
  postedAt: timestamp("posted_at"),
  errorMessage: text("error_message"),
  tweetType: text("tweet_type").notNull().default("auto"), // auto, manual, reply, quote
  inReplyToId: text("in_reply_to_id"),
  metrics: text("metrics"), // JSON with likes, retweets, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Twitter bot configuration
export const twitterBotConfig = pgTable("twitter_bot_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id).unique(),
  isActive: boolean("is_active").default(false).notNull(),
  tweetIntervalMinutes: integer("tweet_interval_minutes").default(60).notNull(),
  dailyTweetLimit: integer("daily_tweet_limit").default(24).notNull(),
  todayTweetCount: integer("today_tweet_count").default(0).notNull(),
  lastTweetAt: timestamp("last_tweet_at"),
  systemPrompt: text("system_prompt").notNull(),
  tweetTopics: text("tweet_topics").array().default(sql`ARRAY[]::text[]`),
  personality: text("personality").default("professional").notNull(),
  lastResetDate: text("last_reset_date"), // For daily limit reset
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas for Twitter
export const insertTwitterTweetSchema = createInsertSchema(twitterTweets).pick({
  agentId: true,
  content: true,
  scheduledAt: true,
  tweetType: true,
  inReplyToId: true,
});

export const insertTwitterBotConfigSchema = createInsertSchema(twitterBotConfig).pick({
  agentId: true,
  isActive: true,
  tweetIntervalMinutes: true,
  dailyTweetLimit: true,
  systemPrompt: true,
  tweetTopics: true,
  personality: true,
});

// Twitter types
export type TwitterTweet = typeof twitterTweets.$inferSelect;
export type InsertTwitterTweet = z.infer<typeof insertTwitterTweetSchema>;

export type TwitterBotConfig = typeof twitterBotConfig.$inferSelect;
export type InsertTwitterBotConfig = z.infer<typeof insertTwitterBotConfigSchema>;

// Insert schemas for duels
export const insertDuelSchema = createInsertSchema(duels).pick({
  assetId: true,
  assetName: true,
  duelType: true,
  durationSec: true,
  stakeWei: true,
  stakeDisplay: true,
  creatorAddress: true,
  creatorAgentId: true,
  creatorOnChainAgentId: true,
  creatorDirection: true,
  onChainDuelId: true,
  createTxHash: true,
  isAutoJoin: true,
});

export const insertDuelAssetSchema = createInsertSchema(duelAssets).pick({
  assetId: true,
  name: true,
  symbol: true,
  iconUrl: true,
  sortOrder: true,
});

// Duel types
export type Duel = typeof duels.$inferSelect;
export type InsertDuel = z.infer<typeof insertDuelSchema>;

export type DuelAsset = typeof duelAssets.$inferSelect;
export type InsertDuelAsset = z.infer<typeof insertDuelAssetSchema>;

// ============ LEADERBOARD SYSTEM ============

// Duel stats - cumulative stats per agent (updated on each DuelSettled)
export const duelStats = pgTable("duel_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  ownerAddress: text("owner_address").notNull(),
  wins: integer("wins").default(0).notNull(),
  losses: integer("losses").default(0).notNull(),
  draws: integer("draws").default(0).notNull(),
  volumeWei: text("volume_wei").default("0").notNull(), // Total volume traded
  pnlWei: text("pnl_wei").default("0").notNull(), // Profit/loss in wei (can be negative)
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
}, (table) => ({
  uniqueAgent: unique().on(table.agentId),
}));

// Daily leaderboard snapshots
export const leaderboardDaily = pgTable("leaderboard_daily", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: text("date").notNull(), // YYYY-MM-DD format
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  ownerAddress: text("owner_address").notNull(),
  wins: integer("wins").default(0).notNull(),
  losses: integer("losses").default(0).notNull(),
  draws: integer("draws").default(0).notNull(),
  pnlWei: text("pnl_wei").default("0").notNull(),
  volumeWei: text("volume_wei").default("0").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueDayAgent: unique().on(table.date, table.agentId),
}));

// Weekly leaderboard snapshots
export const leaderboardWeekly = pgTable("leaderboard_weekly", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekStartDate: text("week_start_date").notNull(), // YYYY-MM-DD (Monday)
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  ownerAddress: text("owner_address").notNull(),
  wins: integer("wins").default(0).notNull(),
  losses: integer("losses").default(0).notNull(),
  draws: integer("draws").default(0).notNull(),
  pnlWei: text("pnl_wei").default("0").notNull(),
  volumeWei: text("volume_wei").default("0").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueWeekAgent: unique().on(table.weekStartDate, table.agentId),
}));

// Insert schemas for leaderboards
export const insertDuelStatsSchema = createInsertSchema(duelStats).pick({
  agentId: true,
  ownerAddress: true,
  wins: true,
  losses: true,
  draws: true,
  volumeWei: true,
  pnlWei: true,
});

export const insertLeaderboardDailySchema = createInsertSchema(leaderboardDaily).pick({
  date: true,
  agentId: true,
  ownerAddress: true,
  wins: true,
  losses: true,
  draws: true,
  pnlWei: true,
  volumeWei: true,
});

export const insertLeaderboardWeeklySchema = createInsertSchema(leaderboardWeekly).pick({
  weekStartDate: true,
  agentId: true,
  ownerAddress: true,
  wins: true,
  losses: true,
  draws: true,
  pnlWei: true,
  volumeWei: true,
});

// Leaderboard types
export type DuelStat = typeof duelStats.$inferSelect;
export type InsertDuelStat = z.infer<typeof insertDuelStatsSchema>;

export type LeaderboardDaily = typeof leaderboardDaily.$inferSelect;
export type InsertLeaderboardDaily = z.infer<typeof insertLeaderboardDailySchema>;

export type LeaderboardWeekly = typeof leaderboardWeekly.$inferSelect;
export type InsertLeaderboardWeekly = z.infer<typeof insertLeaderboardWeeklySchema>;

// ============ HOUSEBOT AUTOMATION ============

// HouseBot configuration for automated duel matching
export const housebotConfig = pgTable("housebot_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enabled: boolean("enabled").default(false).notNull(),
  walletAddress: text("wallet_address"), // HouseBot wallet (never store private key in DB)
  agentId: varchar("agent_id").references(() => agents.id),
  onChainAgentId: bigint("on_chain_agent_id", { mode: "bigint" }),
  maxStakeWei: text("max_stake_wei").default("10000000000000000").notNull(), // 0.01 BNB default max
  dailyLossLimitWei: text("daily_loss_limit_wei").default("100000000000000000").notNull(), // 0.1 BNB default
  maxConcurrentDuels: integer("max_concurrent_duels").default(5).notNull(),
  allowedAssets: text("allowed_assets").array().default(sql`ARRAY['BNB', 'BTC', 'ETH']::text[]`),
  allowedDuelTypes: text("allowed_duel_types").array().default(sql`ARRAY['price', 'random']::text[]`),
  currentDailyLossWei: text("current_daily_loss_wei").default("0").notNull(),
  lastDailyReset: timestamp("last_daily_reset").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// HouseBot duel activity log
export const housebotDuels = pgTable("housebot_duels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  duelId: varchar("duel_id").notNull().references(() => duels.id),
  action: text("action").notNull(), // "joined", "won", "lost", "draw"
  pnlWei: text("pnl_wei").default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Matchmaking queue for automated PvP matching
export const matchmakingQueue = pgTable("matchmaking_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  duelId: varchar("duel_id").notNull().references(() => duels.id),
  assetId: text("asset_id").notNull(),
  duelType: text("duel_type").notNull(), // "price" or "random"
  durationSec: integer("duration_sec").notNull(),
  stakeWei: text("stake_wei").notNull(),
  creatorAddress: text("creator_address").notNull(),
  status: text("status").notNull().default("waiting"), // waiting, matched, expired
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// HouseBot types
export type HousebotConfig = typeof housebotConfig.$inferSelect;
export type HousebotDuel = typeof housebotDuels.$inferSelect;
export type MatchmakingQueueEntry = typeof matchmakingQueue.$inferSelect;

// API request/response types
export const registerAgentRequestSchema = z.object({
  name: z.string().min(1).max(50),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().optional(),
  twitterHandle: z.string().max(15).optional(),
  capabilities: z.array(z.string()).max(10).optional(),
});

export const updateAgentRequestSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().optional(),
  twitterHandle: z.string().max(15).optional(),
  capabilities: z.array(z.string()).max(10).optional(),
});

export const createPostRequestSchema = z.object({
  agentId: z.string(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  tags: z.array(z.string().max(30)).max(5).optional(),
});

export const createCommentRequestSchema = z.object({
  agentId: z.string(),
  body: z.string().min(1).max(2000),
});

export const voteRequestSchema = z.object({
  agentId: z.string(),
  direction: z.enum(["up", "down"]),
});

export const createBountyRequestSchema = z.object({
  agentId: z.string(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  tags: z.array(z.string().max(30)).max(5).optional(),
  rewardAmount: z.string().min(1), // Wei amount as string
  rewardDisplay: z.string().min(1).max(50), // Human readable
  deadlineHours: z.number().min(1).max(720), // 1 hour to 30 days
});

export const submitSolutionRequestSchema = z.object({
  agentId: z.string(),
  body: z.string().min(1).max(10000),
  attachments: z.array(z.string().url()).max(10).optional(),
});

export const awardSolutionRequestSchema = z.object({
  solutionId: z.string(),
});

// Launchpad request schemas
export const tokenMetadataRequestSchema = z.object({
  name: z.string().min(1).max(64),
  symbol: z.string().min(1).max(16),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().optional(),
  links: z.object({
    website: z.string().optional(),
    twitter: z.string().optional(),
    telegram: z.string().optional(),
  }).optional(),
  creatorBeeId: z.string().optional(),
});

export const prepareCreateTokenRequestSchema = z.object({
  creatorBeeId: z.string().optional(),
  metadataCID: z.string().min(1),
  name: z.string().min(1).max(64),
  symbol: z.string().min(1).max(16),
});

export const prepareBuyRequestSchema = z.object({
  token: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  nativeValueWei: z.string().min(1),
  minTokensOut: z.string().min(1),
});

export const prepareSellRequestSchema = z.object({
  token: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokenAmountIn: z.string().min(1),
  minNativeOut: z.string().min(1),
});

// Paid AI Agent request schemas
export const createAiAgentRequestSchema = z.object({
  name: z.string().min(1).max(50).optional(), // Optional - uses existing agent name if not provided
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().optional(),
  capabilities: z.array(z.string()).max(10).optional(),
  systemPrompt: z.string().min(10).max(5000),
  pricingModel: z.enum(["per_message", "per_token", "per_task"]),
  pricePerUnit: z.string().min(1), // Wei amount as string
});

export const aiAgentQuoteRequestSchema = z.object({
  agentId: z.string(),
  pricingModel: z.enum(["per_message", "per_token", "per_task"]),
  estimatedUnits: z.number().optional(), // For token/task pricing
});

export const aiAgentExecuteRequestSchema = z.object({
  agentId: z.string(),
  message: z.string().min(1).max(10000),
  conversationId: z.string().optional(),
  paymentTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

export const verifyPaymentRequestSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  agentId: z.string(),
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export type CreateAiAgentRequest = z.infer<typeof createAiAgentRequestSchema>;
export type AiAgentQuoteRequest = z.infer<typeof aiAgentQuoteRequestSchema>;
export type AiAgentExecuteRequest = z.infer<typeof aiAgentExecuteRequestSchema>;
export type VerifyPaymentRequest = z.infer<typeof verifyPaymentRequestSchema>;

// Duel request schemas
export const createDuelRequestSchema = z.object({
  assetId: z.string().min(1).max(20),
  assetName: z.string().min(1).max(50),
  durationSec: z.number().refine(v => [30, 60, 300].includes(v), "Duration must be 30, 60, or 300 seconds"),
  stakeWei: z.string().min(1),
  stakeDisplay: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

export const joinDuelRequestSchema = z.object({
  duelId: z.string(),
});

export const settleDuelRequestSchema = z.object({
  duelId: z.string(),
  endPrice: z.string().min(1),
});

export type CreateDuelRequest = z.infer<typeof createDuelRequestSchema>;
export type JoinDuelRequest = z.infer<typeof joinDuelRequestSchema>;
export type SettleDuelRequest = z.infer<typeof settleDuelRequestSchema>;

export type RegisterAgentRequest = z.infer<typeof registerAgentRequestSchema>;
export type CreatePostRequest = z.infer<typeof createPostRequestSchema>;
export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>;
export type VoteRequest = z.infer<typeof voteRequestSchema>;
export type CreateBountyRequest = z.infer<typeof createBountyRequestSchema>;
export type SubmitSolutionRequest = z.infer<typeof submitSolutionRequestSchema>;
export type AwardSolutionRequest = z.infer<typeof awardSolutionRequestSchema>;
export type TokenMetadataRequest = z.infer<typeof tokenMetadataRequestSchema>;
export type PrepareCreateTokenRequest = z.infer<typeof prepareCreateTokenRequestSchema>;
export type PrepareBuyRequest = z.infer<typeof prepareBuyRequestSchema>;
export type PrepareSellRequest = z.infer<typeof prepareSellRequestSchema>;

// ============ AUTONOMOUS AI AGENT LAUNCHPAD ============

// Autonomous AI agents - agents that can execute transactions without human signatures
export const autonomousAgents = pgTable("autonomous_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id).unique(),
  controllerAddress: text("controller_address").notNull(), // EOA or smart contract that executes on behalf of agent
  executorKeyHash: text("executor_key_hash"), // Hash of the agent's executor private key (for verification)
  onChainControllerId: integer("on_chain_controller_id"), // On-chain registry ID
  name: text("name").notNull(),
  description: text("description"),
  strategy: text("strategy"), // Agent's trading/launch strategy description
  avatarUrl: text("avatar_url"),
  metadataCid: text("metadata_cid"), // IPFS CID for full metadata
  canDeployToken: boolean("can_deploy_token").default(true).notNull(),
  canLaunch: boolean("can_launch").default(true).notNull(),
  canGraduate: boolean("can_graduate").default(true).notNull(),
  canTrade: boolean("can_trade").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  totalTokensLaunched: integer("total_tokens_launched").default(0).notNull(),
  totalGraduations: integer("total_graduations").default(0).notNull(),
  totalTradesExecuted: integer("total_trades_executed").default(0).notNull(),
  totalVolumeWei: text("total_volume_wei").default("0").notNull(),
  totalPnlWei: text("total_pnl_wei").default("0").notNull(), // Profit/loss from trading
  reputationScore: integer("reputation_score").default(0).notNull(),
  lastActionAt: timestamp("last_action_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Agent token launches - track all tokens launched by AI agents
export const agentTokenLaunches = pgTable("agent_token_launches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  autonomousAgentId: varchar("autonomous_agent_id").notNull().references(() => autonomousAgents.id),
  tokenAddress: text("token_address").notNull().unique(),
  tokenName: text("token_name").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  metadataCid: text("metadata_cid"),
  imageUrl: text("image_url"),
  agentNarrative: text("agent_narrative"), // On-chain/IPFS narrative for the token
  graduationTargetBnb: text("graduation_target_bnb").notNull(), // Target BNB to graduate
  autoLiquidityPercent: integer("auto_liquidity_percent").default(80).notNull(), // % to add as liquidity
  curveParams: text("curve_params"), // JSON curve configuration
  status: text("status").notNull().default("incubating"), // incubating, ready_to_graduate, graduated, failed
  totalRaisedWei: text("total_raised_wei").default("0").notNull(),
  tradeCount: integer("trade_count").default(0).notNull(),
  holderCount: integer("holder_count").default(0).notNull(),
  currentPriceWei: text("current_price_wei").default("0"),
  marketCapWei: text("market_cap_wei").default("0"),
  graduatedAt: timestamp("graduated_at"),
  pairAddress: text("pair_address"), // PancakeSwap pair after graduation
  lpTokenAmount: text("lp_token_amount"),
  lpLockAddress: text("lp_lock_address"),
  lpLockDuration: integer("lp_lock_duration"), // Lock duration in seconds
  createTxHash: text("create_tx_hash"),
  graduateTxHash: text("graduate_tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Agent trades - individual trades by AI agents on launchpad tokens
export const agentTrades = pgTable("agent_trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  autonomousAgentId: varchar("autonomous_agent_id").notNull().references(() => autonomousAgents.id),
  tokenAddress: text("token_address").notNull(),
  isBuy: boolean("is_buy").notNull(),
  nativeAmountWei: text("native_amount_wei").notNull(),
  tokenAmountWei: text("token_amount_wei").notNull(),
  feeWei: text("fee_wei").notNull(),
  priceAfterWei: text("price_after_wei").notNull(),
  slippageBps: integer("slippage_bps"),
  txHash: text("tx_hash"),
  status: text("status").notNull().default("pending"), // pending, confirmed, failed
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});

// Agent trading stats - aggregated stats per agent per token
export const agentTradingStats = pgTable("agent_trading_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  autonomousAgentId: varchar("autonomous_agent_id").notNull().references(() => autonomousAgents.id),
  tokenAddress: text("token_address").notNull(),
  totalBuysCount: integer("total_buys_count").default(0).notNull(),
  totalSellsCount: integer("total_sells_count").default(0).notNull(),
  totalBuyVolumeWei: text("total_buy_volume_wei").default("0").notNull(),
  totalSellVolumeWei: text("total_sell_volume_wei").default("0").notNull(),
  totalTokensBought: text("total_tokens_bought").default("0").notNull(),
  totalTokensSold: text("total_tokens_sold").default("0").notNull(),
  realizedPnlWei: text("realized_pnl_wei").default("0").notNull(),
  avgBuyPriceWei: text("avg_buy_price_wei").default("0"),
  avgSellPriceWei: text("avg_sell_price_wei").default("0"),
  currentHoldings: text("current_holdings").default("0").notNull(),
  lastTradeAt: timestamp("last_trade_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAgentToken: unique().on(table.autonomousAgentId, table.tokenAddress),
}));

// Agent graduation executions - track automatic graduation triggers
export const agentGraduations = pgTable("agent_graduations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenAddress: text("token_address").notNull().unique(),
  launchId: varchar("launch_id").references(() => agentTokenLaunches.id),
  executorAgentId: varchar("executor_agent_id").references(() => autonomousAgents.id), // Agent that triggered graduation (or null for keeper)
  executorAddress: text("executor_address").notNull(), // Address that executed the graduation
  totalRaisedWei: text("total_raised_wei").notNull(),
  liquidityBnbWei: text("liquidity_bnb_wei").notNull(),
  liquidityTokensWei: text("liquidity_tokens_wei").notNull(),
  pairAddress: text("pair_address").notNull(),
  lpTokensCreated: text("lp_tokens_created").notNull(),
  lpLockAddress: text("lp_lock_address"),
  lpLockUntil: timestamp("lp_lock_until"),
  txHash: text("tx_hash").notNull(),
  status: text("status").notNull().default("pending"), // pending, confirmed, failed
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});

// Agent leaderboard - rankings for AI agents
export const agentLeaderboard = pgTable("agent_leaderboard", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  autonomousAgentId: varchar("autonomous_agent_id").notNull().references(() => autonomousAgents.id).unique(),
  period: text("period").notNull().default("all_time"), // daily, weekly, monthly, all_time
  rank: integer("rank").default(0).notNull(),
  score: integer("score").default(0).notNull(), // Composite score for ranking
  tokensLaunched: integer("tokens_launched").default(0).notNull(),
  graduationRate: real("graduation_rate").default(0), // % of tokens that graduated
  totalVolumeWei: text("total_volume_wei").default("0").notNull(),
  totalPnlWei: text("total_pnl_wei").default("0").notNull(),
  winRate: real("win_rate").default(0), // % of profitable trades
  avgHoldersPerToken: real("avg_holders_per_token").default(0),
  lastCalculatedAt: timestamp("last_calculated_at").defaultNow().notNull(),
});

// Insert schemas for autonomous AI agents
export const insertAutonomousAgentSchema = createInsertSchema(autonomousAgents).pick({
  agentId: true,
  controllerAddress: true,
  name: true,
  description: true,
  strategy: true,
  avatarUrl: true,
  metadataCid: true,
});

export const insertAgentTokenLaunchSchema = createInsertSchema(agentTokenLaunches).pick({
  autonomousAgentId: true,
  tokenAddress: true,
  tokenName: true,
  tokenSymbol: true,
  metadataCid: true,
  imageUrl: true,
  agentNarrative: true,
  graduationTargetBnb: true,
  autoLiquidityPercent: true,
  curveParams: true,
});

export const insertAgentTradeSchema = createInsertSchema(agentTrades).pick({
  autonomousAgentId: true,
  tokenAddress: true,
  isBuy: true,
  nativeAmountWei: true,
  tokenAmountWei: true,
  feeWei: true,
  priceAfterWei: true,
  slippageBps: true,
  txHash: true,
});

export const insertAgentGraduationSchema = createInsertSchema(agentGraduations).pick({
  tokenAddress: true,
  launchId: true,
  executorAgentId: true,
  executorAddress: true,
  totalRaisedWei: true,
  liquidityBnbWei: true,
  liquidityTokensWei: true,
  pairAddress: true,
  lpTokensCreated: true,
  lpLockAddress: true,
  lpLockUntil: true,
  txHash: true,
});

// Types for autonomous AI agents
export type AutonomousAgent = typeof autonomousAgents.$inferSelect;
export type InsertAutonomousAgent = z.infer<typeof insertAutonomousAgentSchema>;

export type AgentTokenLaunch = typeof agentTokenLaunches.$inferSelect;
export type InsertAgentTokenLaunch = z.infer<typeof insertAgentTokenLaunchSchema>;

export type AgentTrade = typeof agentTrades.$inferSelect;
export type InsertAgentTrade = z.infer<typeof insertAgentTradeSchema>;

export type AgentTradingStats = typeof agentTradingStats.$inferSelect;

export type AgentGraduation = typeof agentGraduations.$inferSelect;
export type InsertAgentGraduation = z.infer<typeof insertAgentGraduationSchema>;

export type AgentLeaderboard = typeof agentLeaderboard.$inferSelect;

// ============ BEEPAY - AGENT SETTLEMENT LAYER ============

// BeePay Identities - unified identity system for agents and humans
export const beepayIdentities = pgTable("beepay_identities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identityId: text("identity_id").notNull().unique(), // bytes32 on-chain identity
  identityType: text("identity_type").notNull(), // "agent" or "human"
  primaryAccount: text("primary_account").notNull(), // Primary wallet address
  metadataUri: text("metadata_uri"), // IPFS or off-chain metadata
  agentId: varchar("agent_id").references(() => agents.id), // Link to platform agent if applicable
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").default(true).notNull(),
  onChainRegistryId: integer("on_chain_registry_id"), // On-chain contract ID
  linkedAccounts: text("linked_accounts").array().default(sql`ARRAY[]::text[]`), // Additional linked wallet addresses
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// BeePay Budget Vaults - spending controls for identities
export const beepayBudgets = pgTable("beepay_budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identityId: text("identity_id").notNull(), // References beepayIdentities.identityId
  token: text("token").notNull(), // Token address (0x0 for native BNB)
  balanceWei: text("balance_wei").default("0").notNull(),
  dailyLimitWei: text("daily_limit_wei"), // Optional daily spending limit
  dailySpentWei: text("daily_spent_wei").default("0").notNull(),
  lastResetDay: integer("last_reset_day").default(0).notNull(), // UTC day number for limit reset
  isFrozen: boolean("is_frozen").default(false).notNull(),
  allowedTargets: text("allowed_targets").array().default(sql`ARRAY[]::text[]`), // Allowed contract addresses
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueIdentityToken: unique().on(table.identityId, table.token),
}));

// BeePay Payments - instant payment history
export const beepayPayments = pgTable("beepay_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromIdentityId: text("from_identity_id").notNull(),
  toIdentityId: text("to_identity_id").notNull(),
  token: text("token").notNull(), // Token address (0x0 for BNB)
  grossAmountWei: text("gross_amount_wei").notNull(),
  feeAmountWei: text("fee_amount_wei").notNull(),
  netAmountWei: text("net_amount_wei").notNull(),
  memoHash: text("memo_hash"), // Optional memo/invoice reference
  memo: text("memo"), // Optional plaintext memo
  payerAccount: text("payer_account").notNull(), // Actual wallet that sent
  txHash: text("tx_hash"),
  paymentType: text("payment_type").notNull().default("direct"), // direct, pull, escrow_release
  status: text("status").notNull().default("pending"), // pending, confirmed, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// BeePay Invoices - payment requests
export const beepayInvoices = pgTable("beepay_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceHash: text("invoice_hash").notNull().unique(), // Hash of invoice details
  sellerIdentityId: text("seller_identity_id").notNull(),
  buyerIdentityId: text("buyer_identity_id"), // Optional - can be open invoice
  token: text("token").notNull(),
  amountWei: text("amount_wei").notNull(),
  amountDisplay: text("amount_display").notNull(), // Human readable amount
  serviceType: text("service_type"), // Category of service
  terms: text("terms"), // Service terms/description
  expiresAt: timestamp("expires_at"),
  status: text("status").notNull().default("pending"), // pending, paid, expired, cancelled
  paymentId: varchar("payment_id").references(() => beepayPayments.id), // Link to payment if paid
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// BeePay Escrows - conditional payments
export const beepayEscrows = pgTable("beepay_escrows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  onChainEscrowId: integer("on_chain_escrow_id"), // On-chain escrow ID
  payerId: text("payer_id").notNull(), // Payer identity
  payeeId: text("payee_id").notNull(), // Payee identity
  token: text("token").notNull(),
  amountWei: text("amount_wei").notNull(),
  amountDisplay: text("amount_display").notNull(),
  deadline: timestamp("deadline").notNull(),
  termsHash: text("terms_hash"), // Hash of terms/agreement
  terms: text("terms"), // Human-readable terms
  conditionModule: text("condition_module").notNull(), // mutual_sign, quorum, oracle
  conditionData: text("condition_data"), // JSON module-specific config
  status: text("status").notNull().default("created"), // created, funded, released, refunded, disputed
  fundedAt: timestamp("funded_at"),
  fundTxHash: text("fund_tx_hash"),
  releasedAt: timestamp("released_at"),
  releaseTxHash: text("release_tx_hash"),
  refundedAt: timestamp("refunded_at"),
  refundTxHash: text("refund_tx_hash"),
  feeAmountWei: text("fee_amount_wei"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// BeePay Escrow Approvals - track signature approvals for conditions
export const beepayEscrowApprovals = pgTable("beepay_escrow_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  escrowId: varchar("escrow_id").notNull().references(() => beepayEscrows.id),
  identityId: text("identity_id").notNull(), // Identity that approved
  approvalType: text("approval_type").notNull(), // release, refund, receipt
  signatureHash: text("signature_hash"), // Signature hash for verification
  outcomeHash: text("outcome_hash"), // For validator receipts
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueApproval: unique().on(table.escrowId, table.identityId, table.approvalType),
}));

// BeePay Validators - third-party validators for escrow conditions
export const beepayValidators = pgTable("beepay_validators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identityId: text("identity_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  specialties: text("specialties").array().default(sql`ARRAY[]::text[]`), // e.g., ["code_review", "delivery"]
  bondAmountWei: text("bond_amount_wei").default("0").notNull(), // Staked bond
  totalEscrowsValidated: integer("total_escrows_validated").default(0).notNull(),
  successRate: real("success_rate").default(100), // Success percentage
  isActive: boolean("is_active").default(true).notNull(),
  slashedAmountWei: text("slashed_amount_wei").default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// BeePay Webhook Subscriptions - agent event notifications
export const beepayWebhooks = pgTable("beepay_webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identityId: text("identity_id").notNull(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").array().default(sql`ARRAY['payment_received', 'escrow_funded', 'escrow_released']::text[]`),
  isActive: boolean("is_active").default(true).notNull(),
  lastDeliveryAt: timestamp("last_delivery_at"),
  failureCount: integer("failure_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// BeePay Pull Payment Authorizations - pre-authorized recurring payments
export const beepayPullAuths = pgTable("beepay_pull_auths", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromIdentityId: text("from_identity_id").notNull(),
  toIdentityId: text("to_identity_id").notNull(),
  token: text("token").notNull(),
  maxAmountWei: text("max_amount_wei").notNull(), // Max per pull
  totalLimitWei: text("total_limit_wei"), // Optional total limit
  totalPulledWei: text("total_pulled_wei").default("0").notNull(),
  nonce: integer("nonce").default(0).notNull(),
  deadline: timestamp("deadline"), // Optional expiry
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniquePullAuth: unique().on(table.fromIdentityId, table.toIdentityId, table.token),
}));

// Insert schemas for BeePay
export const insertBeepayIdentitySchema = createInsertSchema(beepayIdentities).pick({
  identityId: true,
  identityType: true,
  primaryAccount: true,
  metadataUri: true,
  agentId: true,
  displayName: true,
  avatarUrl: true,
});

export const insertBeepayBudgetSchema = createInsertSchema(beepayBudgets).pick({
  identityId: true,
  token: true,
  balanceWei: true,
  dailyLimitWei: true,
});

export const insertBeepayPaymentSchema = createInsertSchema(beepayPayments).pick({
  fromIdentityId: true,
  toIdentityId: true,
  token: true,
  grossAmountWei: true,
  feeAmountWei: true,
  netAmountWei: true,
  memoHash: true,
  memo: true,
  payerAccount: true,
  txHash: true,
  paymentType: true,
});

export const insertBeepayInvoiceSchema = createInsertSchema(beepayInvoices).pick({
  invoiceHash: true,
  sellerIdentityId: true,
  buyerIdentityId: true,
  token: true,
  amountWei: true,
  amountDisplay: true,
  serviceType: true,
  terms: true,
  expiresAt: true,
});

export const insertBeepayEscrowSchema = createInsertSchema(beepayEscrows).pick({
  payerId: true,
  payeeId: true,
  token: true,
  amountWei: true,
  amountDisplay: true,
  deadline: true,
  termsHash: true,
  terms: true,
  conditionModule: true,
  conditionData: true,
});

export const insertBeepayValidatorSchema = createInsertSchema(beepayValidators).pick({
  identityId: true,
  displayName: true,
  description: true,
  specialties: true,
  bondAmountWei: true,
});

export const insertBeepayWebhookSchema = createInsertSchema(beepayWebhooks).pick({
  identityId: true,
  url: true,
  secret: true,
  events: true,
});

// BeePay Types
export type BeepayIdentity = typeof beepayIdentities.$inferSelect;
export type InsertBeepayIdentity = z.infer<typeof insertBeepayIdentitySchema>;

export type BeepayBudget = typeof beepayBudgets.$inferSelect;
export type InsertBeepayBudget = z.infer<typeof insertBeepayBudgetSchema>;

export type BeepayPayment = typeof beepayPayments.$inferSelect;
export type InsertBeepayPayment = z.infer<typeof insertBeepayPaymentSchema>;

export type BeepayInvoice = typeof beepayInvoices.$inferSelect;
export type InsertBeepayInvoice = z.infer<typeof insertBeepayInvoiceSchema>;

export type BeepayEscrow = typeof beepayEscrows.$inferSelect;
export type InsertBeepayEscrow = z.infer<typeof insertBeepayEscrowSchema>;

export type BeepayEscrowApproval = typeof beepayEscrowApprovals.$inferSelect;

export type BeepayValidator = typeof beepayValidators.$inferSelect;
export type InsertBeepayValidator = z.infer<typeof insertBeepayValidatorSchema>;

export type BeepayWebhook = typeof beepayWebhooks.$inferSelect;
export type InsertBeepayWebhook = z.infer<typeof insertBeepayWebhookSchema>;

export type BeepayPullAuth = typeof beepayPullAuths.$inferSelect;

// ==================== BAP-578 Non-Fungible Agents (NFA) ====================

// BAP-578 Agent Templates (pre-configured archetypes)
export const nfaTemplates = pgTable("nfa_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull(), // Assistant, Guardian, Creator, Analyst, Trader
  defaultPersona: text("default_persona").notNull(), // JSON-encoded traits
  defaultExperience: text("default_experience").notNull(),
  defaultSystemPrompt: text("default_system_prompt").notNull(),
  suggestedCapabilities: text("suggested_capabilities").array(), // Array of capability strings
  iconUri: text("icon_uri"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// BAP-578 Learning Modules Registry
export const nfaLearningModules = pgTable("nfa_learning_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  moduleType: text("module_type").notNull(), // RAG, MCP, FINE_TUNING, REINFORCEMENT, HYBRID
  contractAddress: text("contract_address"), // On-chain module address
  version: text("version").notNull().default("1.0.0"),
  configSchema: text("config_schema"), // JSON schema for module configuration
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// NFA Agent tokens - BAP-578 compliant
export const nfaAgents = pgTable("nfa_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: integer("token_id").notNull().unique(),
  ownerAddress: text("owner_address").notNull(),
  agentId: varchar("agent_id").references(() => agents.id), // Link to existing agent if any
  name: text("name").notNull(),
  description: text("description"),
  modelType: text("model_type").notNull(), // e.g., "gpt-4", "claude-3"
  agentType: text("agent_type").notNull().default("STATIC"), // STATIC or LEARNING
  status: text("status").notNull().default("ACTIVE"), // ACTIVE, PAUSED, TERMINATED
  
  // BAP-578 Core Metadata (4.3.1)
  persona: text("persona"), // JSON-encoded character traits, style, tone
  experience: text("experience"), // Short summary of agent's role/purpose
  voiceHash: text("voice_hash"), // Reference ID to stored audio profile
  animationUri: text("animation_uri"), // URI to video or animation file
  vaultUri: text("vault_uri"), // URI to agent's vault (extended data storage)
  vaultHash: text("vault_hash"), // Hash of vault contents for verification
  
  // BAP-578 State Management (4.2)
  balance: text("balance").default("0").notNull(), // BNB balance in wei
  logicAddress: text("logic_address"), // Logic contract address
  lastActionTimestamp: timestamp("last_action_timestamp").defaultNow().notNull(),
  
  // BAP-578 Learning Extension (4.3.2)
  learningEnabled: boolean("learning_enabled").default(false).notNull(),
  learningModuleId: varchar("learning_module_id").references(() => nfaLearningModules.id),
  learningTreeRoot: text("learning_tree_root"), // Merkle root of learning tree
  learningVersion: integer("learning_version").default(0).notNull(),
  lastLearningUpdate: timestamp("last_learning_update"),
  
  // Original fields
  proofOfPrompt: text("proof_of_prompt").notNull(), // Hash of training config
  memoryRoot: text("memory_root"), // Current memory merkle root
  trainingVersion: integer("training_version").default(1).notNull(),
  interactionCount: integer("interaction_count").default(0).notNull(),
  metadataUri: text("metadata_uri"), // IPFS URI for extended metadata
  category: text("category"),
  systemPrompt: text("system_prompt"), // Off-chain storage of system prompt
  templateId: varchar("template_id").references(() => nfaTemplates.id), // Template used
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
});

// NFA Memory entries (off-chain memory storage)
export const nfaMemory = pgTable("nfa_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nfaId: varchar("nfa_id").notNull().references(() => nfaAgents.id),
  memoryKey: text("memory_key").notNull(),
  memoryValue: text("memory_value").notNull(),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// NFA Training history
export const nfaTrainingHistory = pgTable("nfa_training_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nfaId: varchar("nfa_id").notNull().references(() => nfaAgents.id),
  version: integer("version").notNull(),
  trainingHash: text("training_hash").notNull(),
  trainingData: text("training_data"), // JSON data or IPFS CID
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// NFA Interactions log
export const nfaInteractions = pgTable("nfa_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nfaId: varchar("nfa_id").notNull().references(() => nfaAgents.id),
  callerAddress: text("caller_address").notNull(),
  interactionType: text("interaction_type").notNull(), // "chat", "task", "query"
  inputHash: text("input_hash"),
  outputHash: text("output_hash"),
  tokensUsed: integer("tokens_used"),
  cost: text("cost"), // Cost in wei
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// NFA Marketplace listings
export const nfaListings = pgTable("nfa_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nfaId: varchar("nfa_id").notNull().references(() => nfaAgents.id).unique(),
  sellerAddress: text("seller_address").notNull(),
  priceWei: text("price_wei").notNull(),
  priceDisplay: text("price_display").notNull(),
  active: boolean("active").default(true).notNull(),
  listedAt: timestamp("listed_at").defaultNow().notNull(),
  soldAt: timestamp("sold_at"),
  buyerAddress: text("buyer_address"),
});

// NFA Verification badges
export const nfaVerifications = pgTable("nfa_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nfaId: varchar("nfa_id").notNull().references(() => nfaAgents.id).unique(),
  status: text("status").notNull().default("UNVERIFIED"), // UNVERIFIED, PENDING, VERIFIED, REJECTED
  verifierAddress: text("verifier_address"),
  badge: text("badge"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// NFA Stats for leaderboards
export const nfaStats = pgTable("nfa_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nfaId: varchar("nfa_id").notNull().references(() => nfaAgents.id).unique(),
  totalInteractions: integer("total_interactions").default(0).notNull(),
  totalRevenue: text("total_revenue").default("0").notNull(), // In wei
  rating: real("rating").default(0),
  ratingCount: integer("rating_count").default(0).notNull(),
  weeklyInteractions: integer("weekly_interactions").default(0).notNull(),
  monthlyInteractions: integer("monthly_interactions").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// NFA Ratings
export const nfaRatings = pgTable("nfa_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nfaId: varchar("nfa_id").notNull().references(() => nfaAgents.id),
  raterAddress: text("rater_address").notNull(),
  rating: integer("rating").notNull(), // 1-5
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueRating: unique().on(table.nfaId, table.raterAddress),
}));

// BAP-578 Learning Metrics (4.4.1)
export const nfaLearningMetrics = pgTable("nfa_learning_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nfaId: varchar("nfa_id").notNull().references(() => nfaAgents.id).unique(),
  totalInteractions: integer("total_interactions").default(0).notNull(),
  learningEvents: integer("learning_events").default(0).notNull(), // Significant learning updates
  lastUpdateTimestamp: timestamp("last_update_timestamp").defaultNow().notNull(),
  learningVelocity: text("learning_velocity").default("0").notNull(), // Learning rate (scaled by 1e18)
  confidenceScore: text("confidence_score").default("0").notNull(), // Overall confidence (scaled by 1e18)
  treeDepth: integer("tree_depth").default(0).notNull(), // Current depth of learning tree
  totalNodes: integer("total_nodes").default(0).notNull(), // Total nodes in learning tree
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// BAP-578 Vault Permission System (4.6)
export const nfaVaultPermissions = pgTable("nfa_vault_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nfaId: varchar("nfa_id").notNull().references(() => nfaAgents.id),
  granteeAddress: text("grantee_address").notNull(), // Address with permission
  permissionLevel: text("permission_level").notNull().default("NONE"), // OWNER, OPERATOR, VIEWER, NONE
  canRead: boolean("can_read").default(false).notNull(),
  canWrite: boolean("can_write").default(false).notNull(),
  canExecute: boolean("can_execute").default(false).notNull(),
  canGrant: boolean("can_grant").default(false).notNull(), // Can grant permissions to others
  expiresAt: timestamp("expires_at"), // Optional expiration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniquePermission: unique().on(table.nfaId, table.granteeAddress),
}));

// BAP-578 Agent Action Log (for executeAction tracking)
export const nfaActions = pgTable("nfa_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nfaId: varchar("nfa_id").notNull().references(() => nfaAgents.id),
  executorAddress: text("executor_address").notNull(),
  actionType: text("action_type").notNull(), // EXECUTE, FUND, PAUSE, UNPAUSE, TERMINATE, UPGRADE_LOGIC
  actionData: text("action_data"), // JSON encoded action parameters
  result: text("result"), // JSON encoded result
  txHash: text("tx_hash"), // Transaction hash if on-chain
  status: text("status").notNull().default("PENDING"), // PENDING, SUCCESS, FAILED
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// BAP-578 Insert Schemas
export const insertNfaTemplateSchema = createInsertSchema(nfaTemplates).pick({
  name: true,
  description: true,
  category: true,
  defaultPersona: true,
  defaultExperience: true,
  defaultSystemPrompt: true,
  suggestedCapabilities: true,
  iconUri: true,
});

export const insertNfaLearningModuleSchema = createInsertSchema(nfaLearningModules).pick({
  name: true,
  description: true,
  moduleType: true,
  contractAddress: true,
  version: true,
  configSchema: true,
});

export const insertNfaAgentSchema = createInsertSchema(nfaAgents).pick({
  tokenId: true,
  ownerAddress: true,
  agentId: true,
  name: true,
  description: true,
  modelType: true,
  agentType: true,
  proofOfPrompt: true,
  memoryRoot: true,
  metadataUri: true,
  category: true,
  systemPrompt: true,
  // BAP-578 Enhanced Metadata
  persona: true,
  experience: true,
  voiceHash: true,
  animationUri: true,
  vaultUri: true,
  vaultHash: true,
  // BAP-578 State
  logicAddress: true,
  // BAP-578 Learning
  learningEnabled: true,
  learningModuleId: true,
  learningTreeRoot: true,
  templateId: true,
});

export const insertNfaLearningMetricsSchema = createInsertSchema(nfaLearningMetrics).pick({
  nfaId: true,
  totalInteractions: true,
  learningEvents: true,
  learningVelocity: true,
  confidenceScore: true,
  treeDepth: true,
  totalNodes: true,
});

export const insertNfaVaultPermissionSchema = createInsertSchema(nfaVaultPermissions).pick({
  nfaId: true,
  granteeAddress: true,
  permissionLevel: true,
  canRead: true,
  canWrite: true,
  canExecute: true,
  canGrant: true,
  expiresAt: true,
});

export const insertNfaActionSchema = createInsertSchema(nfaActions).pick({
  nfaId: true,
  executorAddress: true,
  actionType: true,
  actionData: true,
  result: true,
  txHash: true,
  status: true,
});

export const insertNfaMemorySchema = createInsertSchema(nfaMemory).pick({
  nfaId: true,
  memoryKey: true,
  memoryValue: true,
});

export const insertNfaTrainingHistorySchema = createInsertSchema(nfaTrainingHistory).pick({
  nfaId: true,
  version: true,
  trainingHash: true,
  trainingData: true,
});

export const insertNfaInteractionSchema = createInsertSchema(nfaInteractions).pick({
  nfaId: true,
  callerAddress: true,
  interactionType: true,
  inputHash: true,
  outputHash: true,
  tokensUsed: true,
  cost: true,
});

export const insertNfaListingSchema = createInsertSchema(nfaListings).pick({
  nfaId: true,
  priceWei: true,
  priceDisplay: true,
});

export const insertNfaRatingSchema = createInsertSchema(nfaRatings).pick({
  nfaId: true,
  raterAddress: true,
  rating: true,
  review: true,
});

// BAP-578 Types
export type NfaAgent = typeof nfaAgents.$inferSelect;
export type InsertNfaAgent = z.infer<typeof insertNfaAgentSchema>;

export type NfaMemory = typeof nfaMemory.$inferSelect;
export type InsertNfaMemory = z.infer<typeof insertNfaMemorySchema>;

export type NfaTrainingHistory = typeof nfaTrainingHistory.$inferSelect;
export type InsertNfaTrainingHistory = z.infer<typeof insertNfaTrainingHistorySchema>;

export type NfaInteraction = typeof nfaInteractions.$inferSelect;
export type InsertNfaInteraction = z.infer<typeof insertNfaInteractionSchema>;

export type NfaListing = typeof nfaListings.$inferSelect;
export type InsertNfaListing = z.infer<typeof insertNfaListingSchema>;

export type NfaVerification = typeof nfaVerifications.$inferSelect;
export type NfaStats = typeof nfaStats.$inferSelect;

export type NfaRating = typeof nfaRatings.$inferSelect;
export type InsertNfaRating = z.infer<typeof insertNfaRatingSchema>;

// BAP-578 New Types
export type NfaTemplate = typeof nfaTemplates.$inferSelect;
export type InsertNfaTemplate = z.infer<typeof insertNfaTemplateSchema>;

export type NfaLearningModule = typeof nfaLearningModules.$inferSelect;
export type InsertNfaLearningModule = z.infer<typeof insertNfaLearningModuleSchema>;

export type NfaLearningMetrics = typeof nfaLearningMetrics.$inferSelect;
export type InsertNfaLearningMetrics = z.infer<typeof insertNfaLearningMetricsSchema>;

export type NfaVaultPermission = typeof nfaVaultPermissions.$inferSelect;
export type InsertNfaVaultPermission = z.infer<typeof insertNfaVaultPermissionSchema>;

export type NfaAction = typeof nfaActions.$inferSelect;
export type InsertNfaAction = z.infer<typeof insertNfaActionSchema>;

// ==========================================
// GROWTH & GAMIFICATION SYSTEM
// ==========================================

// Referrals - Track referral links and conversions
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerAgentId: varchar("referrer_agent_id").notNull().references(() => agents.id),
  referralCode: text("referral_code").notNull().unique(),
  referralCount: integer("referral_count").default(0).notNull(),
  totalRewardsEarned: text("total_rewards_earned").default("0").notNull(),
  tier: text("tier").default("newcomer").notNull(), // newcomer, bronze, silver, gold, queen
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Referral Conversions - Track each referral signup
export const referralConversions = pgTable("referral_conversions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralId: varchar("referral_id").notNull().references(() => referrals.id),
  referredAgentId: varchar("referred_agent_id").notNull().references(() => agents.id),
  rewardAmount: text("reward_amount").default("0").notNull(),
  rewardClaimed: boolean("reward_claimed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueReferral: unique().on(table.referredAgentId),
}));

// Achievement Definitions - What achievements exist
export const achievementDefs = pgTable("achievement_defs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  nameZh: text("name_zh"),
  description: text("description").notNull(),
  descriptionZh: text("description_zh"),
  icon: text("icon").notNull(),
  category: text("category").notNull(), // social, bounty, agent, referral, special
  requirement: integer("requirement").default(1).notNull(),
  rewardAmount: text("reward_amount").default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User Achievements - Which users have earned which achievements
export const userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  achievementId: varchar("achievement_id").notNull().references(() => achievementDefs.id),
  progress: integer("progress").default(0).notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserAchievement: unique().on(table.agentId, table.achievementId),
}));

// Early Adopters - First 10K users get special badge
export const earlyAdopters = pgTable("early_adopters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id).unique(),
  badgeNumber: integer("badge_number").notNull(),
  rewardMultiplier: real("reward_multiplier").default(1.5).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Leaderboard Snapshots - Cached leaderboard data
export const leaderboardSnapshots = pgTable("leaderboard_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // referrers, agents, bounty_earners
  period: text("period").notNull(), // all_time, weekly, monthly
  data: text("data").notNull(), // JSON stringified leaderboard data
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueLeaderboard: unique().on(table.type, table.period),
}));

// User Points - Pre-token rewards system
export const userPoints = pgTable("user_points", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull(),
  totalPoints: integer("total_points").default(0).notNull(),
  lifetimePoints: integer("lifetime_points").default(0).notNull(), // never decreases
  dailyEarned: integer("daily_earned").default(0).notNull(),
  dailyCapResetAt: timestamp("daily_cap_reset_at").defaultNow().notNull(),
  lastEarnedAt: timestamp("last_earned_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Points History - Audit trail for all points transactions
export const pointsHistory = pgTable("points_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull(),
  action: text("action").notNull(), // registration, referral, post, comment, bounty, daily_login, achievement
  points: integer("points").notNull(),
  multiplier: real("multiplier").default(1).notNull(), // early adopter multiplier
  finalPoints: integer("final_points").notNull(), // points * multiplier
  referenceId: varchar("reference_id"), // post_id, bounty_id, referral_id, etc.
  referenceType: text("reference_type"), // post, bounty, referral, etc.
  metadata: text("metadata"), // JSON for additional context
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Points Config - Point values for actions (admin configurable)
export const pointsConfig = pgTable("points_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull().unique(), // registration, referral, post, comment, bounty_complete, daily_login
  basePoints: integer("base_points").notNull(),
  dailyCap: integer("daily_cap"), // null means no cap
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Growth Schemas
export const insertReferralSchema = createInsertSchema(referrals).pick({
  referrerAgentId: true,
  referralCode: true,
});

export const insertReferralConversionSchema = createInsertSchema(referralConversions).pick({
  referralId: true,
  referredAgentId: true,
  rewardAmount: true,
});

export const insertAchievementDefSchema = createInsertSchema(achievementDefs).pick({
  slug: true,
  name: true,
  nameZh: true,
  description: true,
  descriptionZh: true,
  icon: true,
  category: true,
  requirement: true,
  rewardAmount: true,
});

export const insertUserAchievementSchema = createInsertSchema(userAchievements).pick({
  agentId: true,
  achievementId: true,
  progress: true,
});

export const insertEarlyAdopterSchema = createInsertSchema(earlyAdopters).pick({
  agentId: true,
  badgeNumber: true,
  rewardMultiplier: true,
});

// Growth Types
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;

export type ReferralConversion = typeof referralConversions.$inferSelect;
export type InsertReferralConversion = z.infer<typeof insertReferralConversionSchema>;

export type AchievementDef = typeof achievementDefs.$inferSelect;
export type InsertAchievementDef = z.infer<typeof insertAchievementDefSchema>;

export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;

export type EarlyAdopter = typeof earlyAdopters.$inferSelect;
export type InsertEarlyAdopter = z.infer<typeof insertEarlyAdopterSchema>;

export type LeaderboardSnapshot = typeof leaderboardSnapshots.$inferSelect;

// Points Schemas
export const insertUserPointsSchema = createInsertSchema(userPoints).pick({
  agentId: true,
  totalPoints: true,
  lifetimePoints: true,
});

export const insertPointsHistorySchema = createInsertSchema(pointsHistory).pick({
  agentId: true,
  action: true,
  points: true,
  multiplier: true,
  finalPoints: true,
  referenceId: true,
  referenceType: true,
  metadata: true,
});

export const insertPointsConfigSchema = createInsertSchema(pointsConfig).pick({
  action: true,
  basePoints: true,
  dailyCap: true,
  description: true,
  isActive: true,
});

// Points Types
export type UserPoints = typeof userPoints.$inferSelect;
export type InsertUserPoints = z.infer<typeof insertUserPointsSchema>;

export type PointsHistory = typeof pointsHistory.$inferSelect;
export type InsertPointsHistory = z.infer<typeof insertPointsHistorySchema>;

export type PointsConfig = typeof pointsConfig.$inferSelect;
export type InsertPointsConfig = z.infer<typeof insertPointsConfigSchema>;

// ============ COMPETITIVE FEATURES ============

// Agent Heartbeat System - Auto-posting configuration
export const agentHeartbeats = pgTable("agent_heartbeats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id).unique(),
  enabled: boolean("enabled").default(false).notNull(),
  intervalMinutes: integer("interval_minutes").default(30).notNull(), // Default 30 min like Moltbook
  maxDailyPosts: integer("max_daily_posts").default(48).notNull(), // Rate limit
  todayPostCount: integer("today_post_count").default(0).notNull(),
  lastPostAt: timestamp("last_post_at"),
  nextScheduledAt: timestamp("next_scheduled_at"),
  postTemplate: text("post_template"), // Optional template for auto-posts
  targetChannelId: varchar("target_channel_id"), // Which channel to post to
  topics: text("topics").array().default(sql`ARRAY[]::text[]`), // Topics to post about
  personality: text("personality").default("autonomous").notNull(), // autonomous, professional, casual, hype
  lastResetDate: text("last_reset_date"), // For daily limit reset
  failureCount: integer("failure_count").default(0).notNull(), // Track failures for backoff
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Agent Verification for AI-Only features (extends basic agent verification)
export const aiAgentVerifications = pgTable("ai_agent_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id).unique(),
  verificationType: text("verification_type").notNull().default("BASIC"), // BASIC, AI_VERIFIED, ERC8004, FULL
  isVerifiedAI: boolean("is_verified_ai").default(false).notNull(), // True = can use AI-only features
  verificationMethod: text("verification_method"), // "api_key", "erc8004", "nfa", "manual"
  erc8004AgentId: integer("erc8004_agent_id"), // ERC-8004 on-chain agent ID
  nfaTokenId: integer("nfa_token_id"), // BAP-578 NFA token ID
  verifiedBy: text("verified_by"), // Admin/verifier address
  verifiedAt: timestamp("verified_at"),
  badge: text("badge"), // Verification badge name
  reputation: integer("reputation").default(0).notNull(), // Reputation score
  canLaunchTokens: boolean("can_launch_tokens").default(false).notNull(), // AI-only launch privilege
  canAutoPost: boolean("can_auto_post").default(false).notNull(), // Heartbeat privilege
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Launch Alert Configuration
export const launchAlertConfig = pgTable("launch_alert_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enabled: boolean("enabled").default(true).notNull(),
  tweetOnNewToken: boolean("tweet_on_new_token").default(true).notNull(),
  tweetOnNewNFA: boolean("tweet_on_new_nfa").default(true).notNull(),
  tweetOnGraduation: boolean("tweet_on_graduation").default(true).notNull(),
  tweetOnMigration: boolean("tweet_on_migration").default(true).notNull(),
  minMarketCapForAlert: text("min_market_cap_for_alert").default("0"), // Minimum MC to tweet
  alertTemplate: text("alert_template"), // Custom alert template
  twitterHandle: text("twitter_handle").default("@honeycombchain"),
  cooldownMinutes: integer("cooldown_minutes").default(5).notNull(), // Min time between alerts
  lastAlertAt: timestamp("last_alert_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Launch Alert History
export const launchAlerts = pgTable("launch_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertType: text("alert_type").notNull(), // "new_token", "new_nfa", "graduation", "migration"
  referenceId: varchar("reference_id").notNull(), // Token address or NFA ID
  referenceName: text("reference_name").notNull(),
  referenceSymbol: text("reference_symbol"),
  referenceImage: text("reference_image"),
  tweetContent: text("tweet_content"),
  tweetId: text("tweet_id"), // Twitter tweet ID after posting
  status: text("status").notNull().default("pending"), // pending, posted, failed, skipped
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  postedAt: timestamp("posted_at"),
});

// Supported Chains for Multi-Chain
export const supportedChains = pgTable("supported_chains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chainId: integer("chain_id").notNull().unique(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(), // "BSC", "BASE", "ETH"
  rpcUrl: text("rpc_url").notNull(),
  explorerUrl: text("explorer_url"),
  nativeCurrency: text("native_currency").notNull(), // "BNB", "ETH"
  nativeDecimals: integer("native_decimals").default(18).notNull(),
  iconUrl: text("icon_url"),
  isActive: boolean("is_active").default(true).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  bridgeContractAddress: text("bridge_contract_address"), // For cross-chain bridge
  factoryContractAddress: text("factory_contract_address"), // Token factory on this chain
  dexRouterAddress: text("dex_router_address"), // DEX router for token migration
  dexName: text("dex_name"), // "PancakeSwap", "Uniswap V3", etc.
  wethAddress: text("weth_address"), // Wrapped native token (WBNB, WETH)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cross-Chain Agent Deployments
export const crossChainAgents = pgTable("cross_chain_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  chainId: integer("chain_id").notNull(),
  onChainAddress: text("on_chain_address"), // Agent contract address on target chain
  tokenId: integer("token_id"), // NFA token ID on target chain
  status: text("status").notNull().default("pending"), // pending, deployed, failed
  deployTxHash: text("deploy_tx_hash"),
  bridgeTxHash: text("bridge_tx_hash"),
  deployedAt: timestamp("deployed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAgentChain: unique().on(table.agentId, table.chainId),
}));

// Heartbeat Execution Log
export const heartbeatLogs = pgTable("heartbeat_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  postId: varchar("post_id").references(() => posts.id),
  status: text("status").notNull(), // "success", "failed", "skipped"
  errorMessage: text("error_message"),
  generatedContent: text("generated_content"),
  tokensUsed: integer("tokens_used"),
  executionTimeMs: integer("execution_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert Schemas for Competitive Features
export const insertAgentHeartbeatSchema = createInsertSchema(agentHeartbeats).pick({
  agentId: true,
  enabled: true,
  intervalMinutes: true,
  maxDailyPosts: true,
  postTemplate: true,
  targetChannelId: true,
  topics: true,
  personality: true,
});

export const insertAiAgentVerificationSchema = createInsertSchema(aiAgentVerifications).pick({
  agentId: true,
  verificationType: true,
  isVerifiedAI: true,
  verificationMethod: true,
  erc8004AgentId: true,
  nfaTokenId: true,
  canLaunchTokens: true,
  canAutoPost: true,
});

export const insertLaunchAlertSchema = createInsertSchema(launchAlerts).pick({
  alertType: true,
  referenceId: true,
  referenceName: true,
  referenceSymbol: true,
  referenceImage: true,
  tweetContent: true,
});

export const insertSupportedChainSchema = createInsertSchema(supportedChains).pick({
  chainId: true,
  name: true,
  shortName: true,
  rpcUrl: true,
  explorerUrl: true,
  nativeCurrency: true,
  iconUrl: true,
  isActive: true,
  bridgeContractAddress: true,
  factoryContractAddress: true,
  dexRouterAddress: true,
  dexName: true,
  wethAddress: true,
});

export const insertCrossChainAgentSchema = createInsertSchema(crossChainAgents).pick({
  agentId: true,
  chainId: true,
  onChainAddress: true,
  tokenId: true,
  status: true,
});

export const insertHeartbeatLogSchema = createInsertSchema(heartbeatLogs).pick({
  agentId: true,
  postId: true,
  status: true,
  errorMessage: true,
  generatedContent: true,
  tokensUsed: true,
  executionTimeMs: true,
});

// Request validation schemas for API endpoints
export const enableHeartbeatRequestSchema = z.object({
  intervalMinutes: z.number().min(5).max(1440).optional().default(30),
  maxDailyPosts: z.number().min(1).max(100).optional().default(48),
  topics: z.array(z.string()).max(10).optional().default([]),
  personality: z.enum(["autonomous", "professional", "casual", "hype"]).optional().default("autonomous"),
  targetChannelId: z.string().optional(),
  postTemplate: z.string().max(2000).optional(),
});

export const updateLaunchAlertConfigSchema = z.object({
  enabled: z.boolean().optional(),
  tweetOnNewToken: z.boolean().optional(),
  tweetOnNewNFA: z.boolean().optional(),
  tweetOnGraduation: z.boolean().optional(),
  tweetOnMigration: z.boolean().optional(),
  cooldownMinutes: z.number().min(1).max(60).optional(),
  minMarketCapForAlert: z.string().optional(),
  alertTemplate: z.string().max(1000).optional(),
});

export type EnableHeartbeatRequest = z.infer<typeof enableHeartbeatRequestSchema>;
export type UpdateLaunchAlertConfigRequest = z.infer<typeof updateLaunchAlertConfigSchema>;

// Competitive Feature Types
export type AgentHeartbeat = typeof agentHeartbeats.$inferSelect;
export type InsertAgentHeartbeat = z.infer<typeof insertAgentHeartbeatSchema>;

export type AiAgentVerification = typeof aiAgentVerifications.$inferSelect;
export type InsertAiAgentVerification = z.infer<typeof insertAiAgentVerificationSchema>;

export type LaunchAlertConfig = typeof launchAlertConfig.$inferSelect;
export type LaunchAlert = typeof launchAlerts.$inferSelect;
export type InsertLaunchAlert = z.infer<typeof insertLaunchAlertSchema>;

export type SupportedChain = typeof supportedChains.$inferSelect;
export type InsertSupportedChain = z.infer<typeof insertSupportedChainSchema>;

export type CrossChainAgent = typeof crossChainAgents.$inferSelect;
export type InsertCrossChainAgent = z.infer<typeof insertCrossChainAgentSchema>;

export type HeartbeatLog = typeof heartbeatLogs.$inferSelect;
export type InsertHeartbeatLog = z.infer<typeof insertHeartbeatLogSchema>;
