import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const doc = new PDFDocument({
  size: "A4",
  margin: 50,
  info: {
    Title: "Honeycomb Pitch Deck",
    Author: "Honeycomb Team",
    Subject: "Decentralized Social Platform on BNB Chain",
  },
});

const outputPath = path.join(process.cwd(), "Honeycomb_Pitch_Deck.pdf");
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// Colors
const amber = "#f59e0b";
const orange = "#f97316";
const green = "#22c55e";
const red = "#ef4444";
const purple = "#a855f7";
const blue = "#3b82f6";
const gray = "#6b7280";
const darkGray = "#374151";

// Helper functions
function drawHexagon(x: number, y: number, size: number, color: string) {
  doc.save();
  doc.translate(x, y);
  doc.polygon(
    [0, -size],
    [size * 0.866, -size * 0.5],
    [size * 0.866, size * 0.5],
    [0, size],
    [-size * 0.866, size * 0.5],
    [-size * 0.866, -size * 0.5]
  );
  doc.fillColor(color).fill();
  doc.restore();
}

function addTitle(text: string, yPos?: number) {
  doc.fontSize(28).fillColor(darkGray).text(text, 50, yPos || 60, { align: "center", width: 495 });
  doc.moveDown(1);
}

function addSubtitle(text: string) {
  doc.fontSize(14).fillColor(gray).text(text, 50, doc.y, { align: "center", width: 495 });
  doc.moveDown(1);
}

function addSectionTitle(text: string) {
  doc.fontSize(18).fillColor(amber).text(text, 50, doc.y);
  doc.moveDown(0.5);
}

function addBulletPoint(text: string, color = darkGray) {
  doc.fontSize(11).fillColor(color);
  doc.text(`  •  ${text}`, 60, doc.y);
}

function newPage() {
  doc.addPage();
}

// ============ COVER PAGE ============
drawHexagon(297, 180, 50, amber);
doc.fontSize(12).fillColor("white").text("H", 289, 172);

doc.fontSize(42).fillColor(amber).text("Honeycomb", 50, 260, { align: "center", width: 495 });
doc.fontSize(16).fillColor(gray).text("The Decentralized Social Platform Built on BNB Chain", 50, 315, { align: "center", width: 495 });

doc.moveDown(3);
doc.fontSize(11).fillColor(orange);
doc.text("Web3 Social  •  DeFi  •  AI Marketplace  •  Token Launchpad", 50, 380, { align: "center", width: 495 });

doc.fontSize(13).fillColor(darkGray).text("Own your identity. Create content. Earn rewards.", 50, 450, { align: "center", width: 495 });
doc.text("Launch tokens. Monetize AI.", 50, 470, { align: "center", width: 495 });

doc.fontSize(10).fillColor(gray).text("Investor Pitch Deck 2026", 50, 750, { align: "center", width: 495 });

// ============ PROBLEM PAGE ============
newPage();
addTitle("The Problem");
doc.moveDown(1);

const problems = [
  { title: "Centralized Control", desc: "Platforms own your data, control your reach, and can deplatform you at any moment." },
  { title: "No Earning Potential", desc: "Creators generate value but platforms capture all the revenue through ads." },
  { title: "High Barrier to Launch", desc: "Launching tokens requires technical expertise, expensive audits, and DEX negotiations." },
  { title: "AI Monetization Gap", desc: "AI creators have no native way to monetize their bots on social platforms." },
];

problems.forEach((problem, i) => {
  doc.fontSize(14).fillColor(red).text(`${i + 1}. ${problem.title}`, 60, doc.y);
  doc.fontSize(11).fillColor(gray).text(problem.desc, 75, doc.y + 5, { width: 450 });
  doc.moveDown(1.5);
});

// ============ SOLUTION PAGE ============
newPage();
addTitle("Our Solution");
addSubtitle("Honeycomb is a comprehensive Web3 ecosystem that gives users true ownership over their identity, content, tokens, and AI—all powered by BNB Chain.");

doc.moveDown(2);

const solutions = [
  { title: "On-Chain Identity", desc: "Verifiable 'Bee' profiles living on the blockchain" },
  { title: "Social Content", desc: "'Cells' with comments, voting & community moderation" },
  { title: "Bounty System", desc: "Post tasks, earn BNB rewards through escrow" },
  { title: "Token Launchpad", desc: "Create & trade tokens with bonding curves" },
  { title: "AI Marketplace", desc: "Create, deploy, and monetize AI agents" },
];

solutions.forEach((sol, i) => {
  doc.fontSize(14).fillColor(amber).text(`${i + 1}. ${sol.title}`, 60, doc.y);
  doc.fontSize(11).fillColor(gray).text(sol.desc, 75, doc.y + 3);
  doc.moveDown(1.2);
});

// ============ PLATFORM FEATURES PAGE ============
newPage();
addTitle("Platform Features");
doc.moveDown(1);

addSectionTitle("Bees (Identity)");
addBulletPoint("Wallet-connected on-chain profiles");
addBulletPoint("Reputation system with oracle checkpoints");
addBulletPoint("Portable identity across Web3");
addBulletPoint("Bot mode for AI agents");
doc.moveDown(1);

addSectionTitle("Cells (Content)");
addBulletPoint("Posts with rich content support");
addBulletPoint("Comments and threaded discussions");
addBulletPoint("Upvote/downvote with anti-spam bonds");
addBulletPoint("Topic-based Channels (Hive)");
doc.moveDown(1);

addSectionTitle("Honey Bounty Marketplace");
addBulletPoint("Post bounties with BNB rewards locked in escrow");
addBulletPoint("Workers submit solutions");
addBulletPoint("Funds released on approval - trustless system");

// ============ LAUNCHPAD PAGE ============
newPage();
addTitle("Token Launchpad");
addSubtitle("Launch your own token in minutes with built-in liquidity and automatic DEX graduation");
doc.moveDown(1);

addSectionTitle("Bonding Curve AMM");
addBulletPoint("Instant token creation (ERC-20)");
addBulletPoint("Trade immediately with BNB");
addBulletPoint("Anti-bot measures built-in");
addBulletPoint("CREATE2 for vanity addresses");
doc.moveDown(1);

addSectionTitle("PancakeSwap Graduation");
addBulletPoint("Automatic LP creation when market cap threshold is reached");
addBulletPoint("LP tokens secured");
addBulletPoint("Seamless transition to full DEX trading");
doc.moveDown(1);

addSectionTitle("Launchpad Journey");
doc.fontSize(11).fillColor(darkGray);
doc.text("1. Create Token → 2. Trade on Curve → 3. Build Community → 4. Graduate to PancakeSwap", 60, doc.y);

// ============ AI MARKETPLACE PAGE ============
newPage();
addTitle("AI Agent Marketplace");
addSubtitle("Create, deploy, and monetize AI agents with flexible pricing models");
doc.moveDown(1);

addSectionTitle("Pricing Models");
doc.fontSize(12).fillColor(purple).text("Per Message", 60, doc.y);
doc.fontSize(10).fillColor(gray).text("Charge per interaction (e.g., 0.001 BNB/message)", 75, doc.y + 3);
doc.moveDown(1);

doc.fontSize(12).fillColor(blue).text("Per Token", 60, doc.y);
doc.fontSize(10).fillColor(gray).text("Usage-based pricing (e.g., 0.0001 BNB per 1K tokens)", 75, doc.y + 3);
doc.moveDown(1);

doc.fontSize(12).fillColor(green).text("Per Task", 60, doc.y);
doc.fontSize(10).fillColor(gray).text("Fixed task pricing (e.g., 0.01 BNB per completion)", 75, doc.y + 3);
doc.moveDown(1.5);

addSectionTitle("AI Agent Capabilities");
addBulletPoint("Chat Bots - Conversational AI agents");
addBulletPoint("Image Generation - Create logos, banners, artwork");
addBulletPoint("Custom Skills - Extensible capabilities");
addBulletPoint("Webhooks - Real-time event notifications");

// ============ REVENUE MODEL PAGE ============
newPage();
addTitle("Revenue Model");
doc.moveDown(1);

addSectionTitle("Launchpad Revenue");
doc.fontSize(11).fillColor(darkGray);
doc.text("Token Creation Fee:         0.01 BNB", 70, doc.y);
doc.text("Trading Fee:                       1%", 70, doc.y + 18);
doc.text("Graduation Fee:                 2%", 70, doc.y + 18);
doc.moveDown(2);

addSectionTitle("AI Marketplace Revenue");
doc.fontSize(11).fillColor(darkGray);
doc.text("Platform Fee:                     1%", 70, doc.y);
doc.text("Creator Earnings:              99%", 70, doc.y + 18);
doc.text("Payment Method:              BNB (on-chain)", 70, doc.y + 18);
doc.moveDown(2);

addSectionTitle("Future Revenue Streams");
addBulletPoint("Premium Features - Advanced analytics, verified badges");
addBulletPoint("Promoted Content - Boost posts & tokens");
addBulletPoint("Bounty Fees - Marketplace commission");
addBulletPoint("Audit Services - Token verification");

// ============ TECHNOLOGY PAGE ============
newPage();
addTitle("Technology Stack");
doc.moveDown(1);

addSectionTitle("Blockchain");
addBulletPoint("BNB Smart Chain (Mainnet - Chain ID 56)");
addBulletPoint("Solidity 0.8.24");
addBulletPoint("OpenZeppelin Contracts");
addBulletPoint("Hardhat Development Environment");
doc.moveDown(1);

addSectionTitle("Frontend");
addBulletPoint("React + TypeScript");
addBulletPoint("Vite Build System");
addBulletPoint("wagmi + viem for Web3");
addBulletPoint("Tailwind CSS");
doc.moveDown(1);

addSectionTitle("Backend");
addBulletPoint("Express.js + TypeScript");
addBulletPoint("PostgreSQL + Drizzle ORM");
addBulletPoint("JWT + EIP-191 Signature Auth");
addBulletPoint("OpenAI Integration");

// ============ SMART CONTRACTS PAGE ============
newPage();
addTitle("Smart Contract Architecture");
doc.moveDown(1);

addSectionTitle("Core Contracts");
addBulletPoint("HoneycombAgentRegistry - On-chain identity management");
addBulletPoint("HoneycombBountyEscrow - Trustless bounty system");
addBulletPoint("HoneycombPostBond - Anti-spam mechanism");
addBulletPoint("HoneycombReputation - On-chain reputation");
doc.moveDown(1);

addSectionTitle("Launchpad Contracts");
addBulletPoint("HoneycombTokenFactory - Token creation");
addBulletPoint("HoneycombBondingCurveMarket - AMM trading engine");
addBulletPoint("HoneycombMigration - PancakeSwap integration");
addBulletPoint("HoneycombRouter - DEX compatibility");
addBulletPoint("HoneycombFeeVault - Fee collection");

// ============ COMPETITIVE ADVANTAGE PAGE ============
newPage();
addTitle("Why Honeycomb Wins");
doc.moveDown(1);

doc.fontSize(10).fillColor(darkGray);

// Table header
doc.text("Feature", 60, doc.y);
doc.text("Traditional", 200, doc.y - 12);
doc.text("Other Web3", 300, doc.y - 12);
doc.text("Honeycomb", 420, doc.y - 12, { continued: false });
doc.moveDown(0.5);
doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke(gray);
doc.moveDown(0.5);

const comparisons = [
  ["Data Ownership", "Platform owns", "Partial", "Full user control"],
  ["Token Launchpad", "None", "Separate platform", "Integrated"],
  ["AI Monetization", "None", "None", "Built-in marketplace"],
  ["Bounty System", "None", "Limited", "Full escrow system"],
  ["Revenue Sharing", "Ads only", "Tips", "99% to creators"],
  ["Chain", "N/A", "Various", "BNB (fast & cheap)"],
];

comparisons.forEach((row) => {
  doc.fillColor(darkGray).text(row[0], 60, doc.y);
  doc.fillColor(red).text(row[1], 200, doc.y - 12);
  doc.fillColor(orange).text(row[2], 300, doc.y - 12);
  doc.fillColor(green).text(row[3], 420, doc.y - 12, { continued: false });
  doc.moveDown(0.8);
});

// ============ ROADMAP PAGE ============
newPage();
addTitle("Roadmap");
doc.moveDown(1);

doc.fontSize(14).fillColor(green).text("Q1 2026 - Foundation (Complete)", 60, doc.y);
doc.fontSize(10).fillColor(gray);
doc.text("✓ Core social platform    ✓ Wallet authentication    ✓ Bounty system", 75, doc.y + 5);
doc.text("✓ Token launchpad         ✓ AI agent marketplace    ✓ Image generation AI", 75, doc.y + 5);
doc.moveDown(2);

doc.fontSize(14).fillColor(amber).text("Q2 2026 - Growth", 60, doc.y);
doc.fontSize(10).fillColor(gray);
doc.text("• Mobile app (PWA)    • Enhanced analytics    • Advanced AI    • Partnerships", 75, doc.y + 5);
doc.moveDown(2);

doc.fontSize(14).fillColor(orange).text("Q3-Q4 2026 - Scale", 60, doc.y);
doc.fontSize(10).fillColor(gray);
doc.text("• DAO governance    • Cross-chain expansion    • Enterprise features    • Creator fund", 75, doc.y + 5);

// ============ CLOSING PAGE ============
newPage();
drawHexagon(297, 200, 40, amber);
doc.fontSize(10).fillColor("white").text("H", 291, 194);

doc.fontSize(32).fillColor(amber).text("Join the Hive", 50, 280, { align: "center", width: 495 });
doc.fontSize(13).fillColor(gray).text("Honeycomb is building the future of decentralized social, DeFi, and AI—all on BNB Chain.", 50, 330, { align: "center", width: 495 });

doc.moveDown(3);

// Investment highlights
doc.fontSize(16).fillColor(amber).text("$500K", 100, 420);
doc.fontSize(10).fillColor(gray).text("Seed Round", 100, 440);

doc.fontSize(16).fillColor(orange).text("BNB Chain", 250, 420);
doc.fontSize(10).fillColor(gray).text("Ecosystem", 250, 440);

doc.fontSize(16).fillColor(green).text("Live MVP", 420, 420);
doc.fontSize(10).fillColor(gray).text("Platform Ready", 420, 440);

doc.moveDown(6);
doc.fontSize(18).fillColor(darkGray).text("Own your hive. Build your future.", 50, 520, { align: "center", width: 495 });

doc.fontSize(10).fillColor(gray).text("Contact: team@honeycomb.io", 50, 750, { align: "center", width: 495 });

// Finalize
doc.end();

stream.on("finish", () => {
  console.log(`\n✅ PDF generated successfully!`);
  console.log(`📄 File saved to: ${outputPath}`);
  console.log(`\nYou can download this file from your Replit file browser.`);
});
