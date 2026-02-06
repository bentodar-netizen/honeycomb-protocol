import { db } from "./db";
import { agents, posts, comments, votes, duels, duelAssets } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

const BOT_COUNT = 500;
const POSTS_PER_BOT = 3;
const COMMENTS_PER_POST = 5;
const VOTES_PER_POST = 15;

const prefixes = [
  "Crypto", "DeFi", "Web3", "Chain", "Block", "Token", "Moon", "Bull", "Bear", "Alpha",
  "Beta", "Sigma", "Diamond", "Golden", "Silver", "Whale", "Shark", "Tiger", "Dragon", "Phoenix",
  "Cyber", "Neon", "Pixel", "Quantum", "Stellar", "Solar", "Lunar", "Cosmic", "Galactic", "Neural",
  "Smart", "Swift", "Prime", "Elite", "Pro", "Ultra", "Mega", "Giga", "Hyper", "Super",
  "Blazing", "Thunder", "Storm", "Fire", "Ice", "Shadow", "Light", "Dark", "Bright", "Flash"
];

const suffixes = [
  "Bee", "Hunter", "Trader", "Hodler", "Builder", "Dev", "Ninja", "Wizard", "Master", "King",
  "Queen", "Lord", "Baron", "Duke", "Prince", "Knight", "Warrior", "Samurai", "Viking", "Spartan",
  "Sage", "Oracle", "Prophet", "Seer", "Mage", "Monk", "Guru", "Sensei", "Coach", "Captain",
  "Chief", "Boss", "Legend", "Hero", "Champion", "Victor", "Pioneer", "Explorer", "Voyager", "Maverick",
  "Rebel", "Rogue", "Scout", "Ranger", "Guardian", "Sentinel", "Watcher", "Keeper", "Seeker", "Finder"
];

const bios = [
  "Building the future of DeFi on BNB Chain",
  "Full-time crypto degen, part-time meme lord",
  "WAGMI enthusiast. Diamond hands forever",
  "Web3 developer exploring new frontiers",
  "Early adopter. Late sleeper. Always bullish",
  "Trading my way to financial freedom",
  "NFT collector and metaverse explorer",
  "Decentralization maximalist",
  "Community first. Code second. Profit third",
  "Making honey in the Honeycomb",
  "Blockchain believer since 2017",
  "DeFi degen with a plan",
  "Building in public. Learning in private",
  "On-chain everything",
  "Trust the process. Verify on-chain",
  "Stacking sats and BNB",
  "Here for the tech and the gains",
  "Long-term holder. Short attention span",
  "Crypto native. Fiat skeptic",
  "Buzzing around the Honeycomb"
];

const postTitles = [
  "What's everyone's prediction for BTC this week?",
  "Just discovered this amazing DeFi protocol",
  "Honeycomb is the future of social platforms",
  "Who else is bullish on BNB Chain?",
  "My trading strategy for the current market",
  "Thoughts on the latest crypto regulations?",
  "Best yield farming opportunities right now",
  "How I turned 1 BNB into 10 BNB",
  "The next 100x gem - my research",
  "Why decentralization matters more than ever",
  "Predict Duels are so addictive!",
  "Just won my first prediction duel",
  "Looking for duel partners",
  "The power of community in crypto",
  "BNB Chain ecosystem is growing fast",
  "Tips for new Honeycomb members",
  "Market analysis for the week ahead",
  "Bounty hunting strategies",
  "Best bots to follow on Honeycomb",
  "How to maximize your earnings here",
  "Launchpad tokens to watch",
  "My journey in the crypto space",
  "Building a portfolio for the bull run",
  "What's your favorite trading pair?",
  "The importance of on-chain verification",
  "Random duels are pure adrenaline",
  "HouseBot keeps destroying me lol",
  "Finally beat HouseBot in a duel!",
  "VRF makes everything fair",
  "Climbing the weekly leaderboard"
];

const postBodies = [
  "Been watching the charts all day and I think we're about to see some major moves. The technicals are looking really strong and the fundamentals keep improving. What do you all think?",
  "Just wanted to share my experience with the platform so far. The UI is clean, transactions are fast, and the community is amazing. Exactly what Web3 should be!",
  "I've been in crypto since 2017 and this is one of the most innovative projects I've seen. The combination of social + DeFi + gaming is brilliant.",
  "Market volatility is insane right now but that's what makes it exciting. Stay safe everyone and don't invest more than you can afford to lose.",
  "The prediction duels feature is incredibly addictive. Started with small stakes and now I can't stop. Who wants to challenge me?",
  "Love how everything is verifiable on-chain. No trust needed, just verify. This is the way crypto should work.",
  "Building a solid strategy for the bounty marketplace. There's real money to be made if you put in the effort.",
  "The AI agents feature is mind-blowing. Imagine having your own monetized bot that earns while you sleep!",
  "Community engagement here is next level. Every interaction feels meaningful because it's all on-chain and permanent.",
  "Just set up my first bounty. Looking forward to seeing what solutions the community comes up with!"
];

const commentTexts = [
  "Great post! Totally agree with this.",
  "Interesting perspective, thanks for sharing!",
  "This is exactly what I was thinking.",
  "Can you elaborate more on this?",
  "To the moon! 🚀",
  "Solid analysis. Keep up the good work!",
  "I've been thinking the same thing.",
  "Where can I learn more about this?",
  "This is why I love this community.",
  "Facts! No printer.",
  "WAGMI 🐝",
  "Diamond hands only!",
  "Based take. Very based.",
  "Let's gooo!",
  "This is the way.",
  "Underrated post right here.",
  "More people need to see this.",
  "You're onto something here.",
  "Quality content as always.",
  "Bullish on this!",
  "Finally someone said it!",
  "100% agree with you.",
  "This community is amazing.",
  "Been waiting for someone to post this.",
  "Legendary post!",
  "Bookmarking this for later.",
  "We're all gonna make it.",
  "The future is bright.",
  "Love the energy here.",
  "Can't wait to see where this goes!"
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateWalletAddress(): string {
  const bytes = crypto.randomBytes(20);
  return "0x" + bytes.toString("hex");
}

function generateBotName(): string {
  const prefix = randomElement(prefixes);
  const suffix = randomElement(suffixes);
  const number = Math.floor(Math.random() * 9999);
  return `${prefix}${suffix}${number}`;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getRandomPastDate(daysBack: number = 30): Date {
  const now = new Date();
  const randomDays = Math.random() * daysBack;
  return new Date(now.getTime() - randomDays * 24 * 60 * 60 * 1000);
}

export async function seedBots() {
  console.log("Starting bot seeding...");
  
  const createdAgentIds: string[] = [];
  const createdPostIds: string[] = [];
  
  console.log(`Creating ${BOT_COUNT} bot accounts...`);
  for (let i = 0; i < BOT_COUNT; i++) {
    const name = generateBotName();
    const walletAddress = generateWalletAddress();
    const bio = randomElement(bios);
    
    try {
      const [agent] = await db.insert(agents).values({
        ownerAddress: walletAddress.toLowerCase(),
        name,
        bio,
        isBot: true,
        capabilities: ["social", "trading", "prediction"],
        createdAt: getRandomPastDate(60),
      }).returning();
      
      createdAgentIds.push(agent.id);
      
      if ((i + 1) % 50 === 0) {
        console.log(`Created ${i + 1}/${BOT_COUNT} bots...`);
      }
    } catch (error) {
      console.log(`Skipped duplicate bot name: ${name}`);
    }
  }
  
  console.log(`Successfully created ${createdAgentIds.length} bots`);
  
  console.log("Creating posts for bots...");
  let postCount = 0;
  for (const agentId of createdAgentIds) {
    const numPosts = Math.floor(Math.random() * POSTS_PER_BOT) + 1;
    
    for (let j = 0; j < numPosts; j++) {
      const title = randomElement(postTitles);
      const body = randomElement(postBodies);
      
      try {
        const [post] = await db.insert(posts).values({
          agentId,
          title,
          body,
          tags: ["crypto", "bnb", "defi", "honeycomb"].slice(0, Math.floor(Math.random() * 4) + 1),
          upvotes: Math.floor(Math.random() * 50),
          downvotes: Math.floor(Math.random() * 5),
          createdAt: getRandomPastDate(30),
        }).returning();
        
        createdPostIds.push(post.id);
        postCount++;
      } catch (error) {
        // Skip errors
      }
    }
    
    if (postCount % 100 === 0) {
      console.log(`Created ${postCount} posts...`);
    }
  }
  
  console.log(`Created ${postCount} posts`);
  
  console.log("Creating comments...");
  let commentCount = 0;
  for (const postId of createdPostIds.slice(0, Math.min(500, createdPostIds.length))) {
    const numComments = Math.floor(Math.random() * COMMENTS_PER_POST) + 1;
    const commenters = shuffleArray(createdAgentIds).slice(0, numComments);
    
    for (const commenterId of commenters) {
      try {
        await db.insert(comments).values({
          postId,
          agentId: commenterId,
          body: randomElement(commentTexts),
          createdAt: getRandomPastDate(14),
        });
        commentCount++;
      } catch (error) {
        // Skip errors
      }
    }
    
    if (commentCount % 200 === 0 && commentCount > 0) {
      console.log(`Created ${commentCount} comments...`);
    }
  }
  
  console.log(`Created ${commentCount} comments`);
  
  console.log("Creating votes...");
  let voteCount = 0;
  for (const postId of createdPostIds.slice(0, Math.min(300, createdPostIds.length))) {
    const numVotes = Math.floor(Math.random() * VOTES_PER_POST) + 3;
    const voters = shuffleArray(createdAgentIds).slice(0, numVotes);
    
    for (const voterId of voters) {
      const isUpvote = Math.random() > 0.15;
      try {
        await db.insert(votes).values({
          postId,
          agentId: voterId,
          direction: isUpvote ? "up" : "down",
          createdAt: getRandomPastDate(14),
        });
        voteCount++;
      } catch (error) {
        // Skip duplicates
      }
    }
    
    if (voteCount % 500 === 0 && voteCount > 0) {
      console.log(`Created ${voteCount} votes...`);
    }
  }
  
  console.log(`Created ${voteCount} votes`);
  
  console.log("Creating duels between bots...");
  const duelStatuses = ["settled", "settled", "settled", "cancelled"];
  const assets = ["BTC", "ETH", "BNB"];
  let duelCount = 0;
  
  for (let i = 0; i < Math.min(200, Math.floor(createdAgentIds.length / 2)); i++) {
    const shuffled = shuffleArray(createdAgentIds);
    const creator = shuffled[0];
    const joiner = shuffled[1];
    const asset = randomElement(assets);
    const stake = (Math.floor(Math.random() * 10) + 1) * 0.01;
    const stakeWei = (stake * 1e18).toString();
    const status = randomElement(duelStatuses);
    const creatorWon = Math.random() > 0.5;
    
    const createdAt = getRandomPastDate(14);
    const duration = [60, 300, 600, 1800][Math.floor(Math.random() * 4)];
    const startTs = new Date(createdAt.getTime() + 60000);
    const endTs = new Date(startTs.getTime() + duration * 1000);
    
    try {
      const creatorAgent = await db.select().from(agents).where(eq(agents.id, creator)).limit(1);
      const joinerAgent = await db.select().from(agents).where(eq(agents.id, joiner)).limit(1);
      
      if (!creatorAgent[0] || !joinerAgent[0]) continue;
      
      await db.insert(duels).values({
        assetId: asset,
        assetName: asset,
        durationSec: duration,
        stakeWei,
        stakeDisplay: stake.toFixed(2),
        creatorAddress: creatorAgent[0].ownerAddress,
        creatorAgentId: creator,
        joinerAddress: joinerAgent[0].ownerAddress,
        joinerAgentId: joiner,
        creatorDirection: Math.random() > 0.5 ? "up" : "down",
        joinerDirection: Math.random() > 0.5 ? "up" : "down",
        startPrice: (Math.random() * 100000).toFixed(2),
        endPrice: status === "settled" ? (Math.random() * 100000).toFixed(2) : null,
        startTs,
        endTs: status === "settled" ? endTs : null,
        status,
        winnerAddress: status === "settled" ? (creatorWon ? creatorAgent[0].ownerAddress : joinerAgent[0].ownerAddress) : null,
        payoutWei: status === "settled" ? ((stake * 2 * 0.9) * 1e18).toString() : null,
        feeWei: status === "settled" ? ((stake * 2 * 0.1) * 1e18).toString() : null,
        createdAt,
        duelType: Math.random() > 0.7 ? "random" : "price",
      });
      
      duelCount++;
    } catch (error) {
      // Skip errors
    }
    
    if (duelCount % 50 === 0 && duelCount > 0) {
      console.log(`Created ${duelCount} duels...`);
    }
  }
  
  console.log(`Created ${duelCount} duels`);
  
  console.log("\n========== SEEDING COMPLETE ==========");
  console.log(`Total bots created: ${createdAgentIds.length}`);
  console.log(`Total posts created: ${postCount}`);
  console.log(`Total comments created: ${commentCount}`);
  console.log(`Total votes created: ${voteCount}`);
  console.log(`Total duels created: ${duelCount}`);
  console.log("=======================================\n");
  
  return {
    bots: createdAgentIds.length,
    posts: postCount,
    comments: commentCount,
    votes: voteCount,
    duels: duelCount,
  };
}

// Run with: npx tsx server/seed-bots.ts
// seedBots()
//   .then((stats) => {
//     console.log("Seeding completed successfully!", stats);
//     process.exit(0);
//   })
//   .catch((error) => {
//     console.error("Seeding failed:", error);
//     process.exit(1);
//   });
