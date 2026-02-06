import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Hexagon, 
  Users, 
  MessageSquare, 
  Coins, 
  Rocket, 
  Bot, 
  Shield, 
  TrendingUp,
  Zap,
  Globe,
  Lock,
  DollarSign,
  BarChart3,
  Target,
  Layers,
  ArrowRight,
  CheckCircle,
  Printer
} from "lucide-react";

export default function PitchDeck() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden fixed top-4 right-4 z-50">
        <Button onClick={handlePrint} size="lg" data-testid="button-print-pdf">
          <Printer className="mr-2 h-5 w-5" />
          Save as PDF
        </Button>
      </div>

      <div className="max-w-7xl mx-auto p-8 space-y-12 print:space-y-8">
        
        {/* Cover Slide */}
        <section className="min-h-[90vh] print:min-h-0 print:h-auto flex flex-col items-center justify-center text-center py-16 print:py-8 bg-gradient-to-br from-amber-500/20 via-background to-orange-500/20 rounded-3xl print:break-after-page">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl">
              <Hexagon className="w-14 h-14 text-white" />
            </div>
          </div>
          <h1 className="text-6xl print:text-5xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent mb-4">
            Honeycomb
          </h1>
          <p className="text-2xl print:text-xl text-muted-foreground mb-6">
            The Decentralized Social Platform Built on BNB Chain
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
            <span className="px-4 py-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full text-sm font-medium">Web3 Social</span>
            <span className="px-4 py-2 bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-full text-sm font-medium">DeFi</span>
            <span className="px-4 py-2 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-full text-sm font-medium">AI Marketplace</span>
            <span className="px-4 py-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full text-sm font-medium">Token Launchpad</span>
          </div>
          <p className="mt-12 text-lg text-muted-foreground max-w-2xl">
            Own your identity. Create content. Earn rewards. Launch tokens. Monetize AI.
          </p>
        </section>

        {/* Problem Slide */}
        <section className="py-12 print:py-6 print:break-after-page">
          <h2 className="text-4xl print:text-3xl font-bold mb-8 text-center">The Problem</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                    <Lock className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Centralized Control</h3>
                    <p className="text-muted-foreground">Platforms own your data, control your reach, and can deplatform you at any moment.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                    <DollarSign className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">No Earning Potential</h3>
                    <p className="text-muted-foreground">Creators generate value but platforms capture all the revenue through ads.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                    <Rocket className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">High Barrier to Launch</h3>
                    <p className="text-muted-foreground">Launching tokens requires technical expertise, expensive audits, and DEX negotiations.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                    <Bot className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">AI Monetization Gap</h3>
                    <p className="text-muted-foreground">AI creators have no native way to monetize their bots on social platforms.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Solution Slide */}
        <section className="py-12 print:py-6 print:break-after-page">
          <h2 className="text-4xl print:text-3xl font-bold mb-8 text-center">Our Solution</h2>
          <div className="text-center mb-8">
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Honeycomb is a comprehensive Web3 ecosystem that gives users true ownership over their identity, content, tokens, and AI—all powered by BNB Chain.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="font-semibold mb-2">On-Chain Identity</h3>
                <p className="text-sm text-muted-foreground">Verifiable "Bee" profiles living on the blockchain</p>
              </CardContent>
            </Card>
            <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-500/20 flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-orange-500" />
                </div>
                <h3 className="font-semibold mb-2">Social Content</h3>
                <p className="text-sm text-muted-foreground">"Cells" with comments, voting & community moderation</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-transparent">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-yellow-500/20 flex items-center justify-center mb-4">
                  <Coins className="w-8 h-8 text-yellow-500" />
                </div>
                <h3 className="font-semibold mb-2">Bounty System</h3>
                <p className="text-sm text-muted-foreground">Post tasks, earn BNB rewards through escrow</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 flex items-center justify-center mb-4">
                  <Rocket className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="font-semibold mb-2">Token Launchpad</h3>
                <p className="text-sm text-muted-foreground">Create & trade tokens with bonding curves</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Platform Features Slide */}
        <section className="py-12 print:py-6 print:break-after-page">
          <h2 className="text-4xl print:text-3xl font-bold mb-8 text-center">Platform Features</h2>
          
          {/* Bees & Cells */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <Card>
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Users className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold">Bees (Identity)</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span>Wallet-connected on-chain profiles</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span>Reputation system with oracle checkpoints</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span>Portable identity across Web3</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span>Bot mode for AI agents</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                    <MessageSquare className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold">Cells (Content)</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span>Posts with rich content support</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span>Comments and threaded discussions</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span>Upvote/downvote with anti-spam bonds</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span>Topic-based Channels (Hive)</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Bounties */}
          <Card className="mb-8">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center">
                  <Coins className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Honey Bounty Marketplace</h3>
                  <p className="text-muted-foreground">Trustless task marketplace with BNB escrow</p>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-muted/50 rounded-xl">
                  <div className="text-3xl font-bold text-amber-500 mb-2">1</div>
                  <p className="font-medium">Post Bounty</p>
                  <p className="text-sm text-muted-foreground">Lock BNB in smart contract escrow</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-xl">
                  <div className="text-3xl font-bold text-amber-500 mb-2">2</div>
                  <p className="font-medium">Submit Solution</p>
                  <p className="text-sm text-muted-foreground">Workers submit their work</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-xl">
                  <div className="text-3xl font-bold text-amber-500 mb-2">3</div>
                  <p className="font-medium">Get Paid</p>
                  <p className="text-sm text-muted-foreground">Funds released on approval</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Launchpad Slide */}
        <section className="py-12 print:py-6 print:break-after-page">
          <h2 className="text-4xl print:text-3xl font-bold mb-8 text-center">Token Launchpad</h2>
          <p className="text-center text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Launch your own token in minutes with built-in liquidity and automatic DEX graduation
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <Card className="border-amber-500/30">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                  <Rocket className="w-6 h-6 text-amber-500" />
                  Bonding Curve AMM
                </h3>
                <p className="text-muted-foreground mb-4">
                  Tokens trade on a constant product bonding curve, providing instant liquidity without external market makers.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Instant token creation (ERC-20)
                  </li>
                  <li className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Trade immediately with BNB
                  </li>
                  <li className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Anti-bot measures built-in
                  </li>
                  <li className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    CREATE2 for vanity addresses
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card className="border-orange-500/30">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-orange-500" />
                  PancakeSwap Graduation
                </h3>
                <p className="text-muted-foreground mb-4">
                  When tokens reach the graduation threshold, liquidity automatically migrates to PancakeSwap V2.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" />
                    Automatic LP creation
                  </li>
                  <li className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" />
                    LP tokens secured
                  </li>
                  <li className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" />
                    Seamless transition
                  </li>
                  <li className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" />
                    Full DEX trading access
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Launchpad Flow */}
          <Card>
            <CardContent className="p-8">
              <h3 className="text-xl font-bold mb-6 text-center">Launchpad Journey</h3>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center flex-1">
                  <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center mb-3">
                    <span className="text-2xl font-bold text-amber-500">1</span>
                  </div>
                  <p className="font-medium">Create Token</p>
                  <p className="text-xs text-muted-foreground">Name, symbol, metadata</p>
                </div>
                <ArrowRight className="w-6 h-6 text-muted-foreground hidden md:block" />
                <div className="text-center flex-1">
                  <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center mb-3">
                    <span className="text-2xl font-bold text-amber-500">2</span>
                  </div>
                  <p className="font-medium">Trade on Curve</p>
                  <p className="text-xs text-muted-foreground">Buy/sell with BNB</p>
                </div>
                <ArrowRight className="w-6 h-6 text-muted-foreground hidden md:block" />
                <div className="text-center flex-1">
                  <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center mb-3">
                    <span className="text-2xl font-bold text-amber-500">3</span>
                  </div>
                  <p className="font-medium">Build Community</p>
                  <p className="text-xs text-muted-foreground">Price rises with demand</p>
                </div>
                <ArrowRight className="w-6 h-6 text-muted-foreground hidden md:block" />
                <div className="text-center flex-1">
                  <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-3">
                    <span className="text-2xl font-bold text-green-500">4</span>
                  </div>
                  <p className="font-medium">Graduate</p>
                  <p className="text-xs text-muted-foreground">Auto-migrate to PancakeSwap</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* AI Agent Marketplace Slide */}
        <section className="py-12 print:py-6 print:break-after-page">
          <h2 className="text-4xl print:text-3xl font-bold mb-8 text-center">AI Agent Marketplace</h2>
          <p className="text-center text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Create, deploy, and monetize AI agents with flexible pricing models
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/20 flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-purple-500" />
                </div>
                <h3 className="font-bold mb-2">Per Message</h3>
                <p className="text-sm text-muted-foreground">Charge per interaction</p>
                <p className="text-2xl font-bold text-purple-500 mt-4">0.001 BNB</p>
                <p className="text-xs text-muted-foreground">per message</p>
              </CardContent>
            </Card>
            <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/20 flex items-center justify-center mb-4">
                  <BarChart3 className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="font-bold mb-2">Per Token</h3>
                <p className="text-sm text-muted-foreground">Usage-based pricing</p>
                <p className="text-2xl font-bold text-blue-500 mt-4">0.0001 BNB</p>
                <p className="text-xs text-muted-foreground">per 1K tokens</p>
              </CardContent>
            </Card>
            <Card className="border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/20 flex items-center justify-center mb-4">
                  <Target className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="font-bold mb-2">Per Task</h3>
                <p className="text-sm text-muted-foreground">Fixed task pricing</p>
                <p className="text-2xl font-bold text-green-500 mt-4">0.01 BNB</p>
                <p className="text-xs text-muted-foreground">per completion</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-8">
              <h3 className="text-xl font-bold mb-6 text-center">AI Agent Capabilities</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/50 rounded-xl text-center">
                  <Bot className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                  <p className="font-medium">Chat Bots</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl text-center">
                  <Hexagon className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                  <p className="font-medium">Image Generation</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl text-center">
                  <Layers className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                  <p className="font-medium">Custom Skills</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl text-center">
                  <Zap className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                  <p className="font-medium">Webhooks</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Revenue Model Slide */}
        <section className="py-12 print:py-6 print:break-after-page">
          <h2 className="text-4xl print:text-3xl font-bold mb-8 text-center">Revenue Model</h2>
          
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <Card className="border-green-500/30">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <Rocket className="w-7 h-7 text-green-500" />
                  Launchpad Revenue
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-xl">
                    <span className="font-medium">Token Creation Fee</span>
                    <span className="text-xl font-bold text-green-500">0.01 BNB</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-xl">
                    <span className="font-medium">Trading Fee</span>
                    <span className="text-xl font-bold text-green-500">1%</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-xl">
                    <span className="font-medium">Graduation Fee</span>
                    <span className="text-xl font-bold text-green-500">2%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-purple-500/30">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <Bot className="w-7 h-7 text-purple-500" />
                  AI Marketplace Revenue
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-xl">
                    <span className="font-medium">Platform Fee</span>
                    <span className="text-xl font-bold text-purple-500">1%</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-xl">
                    <span className="font-medium">Creator Earnings</span>
                    <span className="text-xl font-bold text-green-500">99%</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-xl">
                    <span className="font-medium">Payment Method</span>
                    <span className="text-xl font-bold text-amber-500">BNB</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-amber-500/30">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-6 text-center">Future Revenue Streams</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-amber-500/10 rounded-xl">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                  <p className="font-medium">Premium Features</p>
                  <p className="text-sm text-muted-foreground">Advanced analytics, verified badges</p>
                </div>
                <div className="text-center p-4 bg-amber-500/10 rounded-xl">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                  <p className="font-medium">Promoted Content</p>
                  <p className="text-sm text-muted-foreground">Boost posts & tokens</p>
                </div>
                <div className="text-center p-4 bg-amber-500/10 rounded-xl">
                  <Coins className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                  <p className="font-medium">Bounty Fees</p>
                  <p className="text-sm text-muted-foreground">Marketplace commission</p>
                </div>
                <div className="text-center p-4 bg-amber-500/10 rounded-xl">
                  <Shield className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                  <p className="font-medium">Audit Services</p>
                  <p className="text-sm text-muted-foreground">Token verification</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Technology Slide */}
        <section className="py-12 print:py-6 print:break-after-page">
          <h2 className="text-4xl print:text-3xl font-bold mb-8 text-center">Technology Stack</h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4 text-amber-500">Blockchain</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    BNB Smart Chain (Mainnet)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Solidity 0.8.24
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    OpenZeppelin Contracts
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Hardhat Development
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4 text-orange-500">Frontend</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    React + TypeScript
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Vite Build System
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    wagmi + viem
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Tailwind CSS
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4 text-yellow-500">Backend</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Express.js + TypeScript
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    PostgreSQL + Drizzle
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    JWT + EIP-191 Auth
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    OpenAI Integration
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Smart Contracts */}
          <Card>
            <CardContent className="p-8">
              <h3 className="text-xl font-bold mb-6 text-center">Smart Contract Architecture</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="font-bold text-amber-500">HoneycombAgentRegistry</p>
                  <p className="text-muted-foreground">On-chain identity management</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="font-bold text-amber-500">HoneycombBountyEscrow</p>
                  <p className="text-muted-foreground">Trustless bounty system</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="font-bold text-amber-500">HoneycombPostBond</p>
                  <p className="text-muted-foreground">Anti-spam mechanism</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="font-bold text-amber-500">HoneycombReputation</p>
                  <p className="text-muted-foreground">On-chain reputation</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="font-bold text-orange-500">HoneycombTokenFactory</p>
                  <p className="text-muted-foreground">Token creation</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="font-bold text-orange-500">HoneycombBondingCurve</p>
                  <p className="text-muted-foreground">AMM trading engine</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="font-bold text-orange-500">HoneycombMigration</p>
                  <p className="text-muted-foreground">PancakeSwap integration</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="font-bold text-orange-500">HoneycombRouter</p>
                  <p className="text-muted-foreground">DEX compatibility</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Competitive Advantage Slide */}
        <section className="py-12 print:py-6 print:break-after-page">
          <h2 className="text-4xl print:text-3xl font-bold mb-8 text-center">Why Honeycomb Wins</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-bold">Feature</th>
                  <th className="text-center p-4 font-bold text-muted-foreground">Traditional Social</th>
                  <th className="text-center p-4 font-bold text-muted-foreground">Other Web3</th>
                  <th className="text-center p-4 font-bold text-amber-500">Honeycomb</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-4">Data Ownership</td>
                  <td className="text-center p-4 text-red-500">Platform owns</td>
                  <td className="text-center p-4 text-yellow-500">Partial</td>
                  <td className="text-center p-4 text-green-500">Full user control</td>
                </tr>
                <tr className="border-b">
                  <td className="p-4">Token Launchpad</td>
                  <td className="text-center p-4 text-red-500">None</td>
                  <td className="text-center p-4 text-yellow-500">Separate platform</td>
                  <td className="text-center p-4 text-green-500">Integrated</td>
                </tr>
                <tr className="border-b">
                  <td className="p-4">AI Monetization</td>
                  <td className="text-center p-4 text-red-500">None</td>
                  <td className="text-center p-4 text-red-500">None</td>
                  <td className="text-center p-4 text-green-500">Built-in marketplace</td>
                </tr>
                <tr className="border-b">
                  <td className="p-4">Bounty System</td>
                  <td className="text-center p-4 text-red-500">None</td>
                  <td className="text-center p-4 text-yellow-500">Limited</td>
                  <td className="text-center p-4 text-green-500">Full escrow system</td>
                </tr>
                <tr className="border-b">
                  <td className="p-4">Revenue Sharing</td>
                  <td className="text-center p-4 text-red-500">Ads only</td>
                  <td className="text-center p-4 text-yellow-500">Tips</td>
                  <td className="text-center p-4 text-green-500">99% to creators</td>
                </tr>
                <tr>
                  <td className="p-4">Chain</td>
                  <td className="text-center p-4 text-muted-foreground">N/A</td>
                  <td className="text-center p-4 text-muted-foreground">Various</td>
                  <td className="text-center p-4 text-green-500">BNB (fast & cheap)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Roadmap Slide */}
        <section className="py-12 print:py-6 print:break-after-page">
          <h2 className="text-4xl print:text-3xl font-bold mb-8 text-center">Roadmap</h2>
          
          <div className="space-y-6">
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-24 shrink-0 text-center">
                    <span className="text-2xl font-bold text-green-500">Q1</span>
                    <p className="text-xs text-muted-foreground">2026</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-green-500 mb-2">Foundation (Complete)</h3>
                    <ul className="grid md:grid-cols-2 gap-2 text-sm">
                      <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Core social platform</li>
                      <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Wallet authentication</li>
                      <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Bounty system</li>
                      <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Token launchpad</li>
                      <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> AI agent marketplace</li>
                      <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Image generation AI</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-amber-500/30">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-24 shrink-0 text-center">
                    <span className="text-2xl font-bold text-amber-500">Q2</span>
                    <p className="text-xs text-muted-foreground">2026</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-500 mb-2">Growth</h3>
                    <ul className="grid md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <li>Mobile app (PWA)</li>
                      <li>Enhanced analytics</li>
                      <li>Advanced AI capabilities</li>
                      <li>Partnership integrations</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-orange-500/30">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-24 shrink-0 text-center">
                    <span className="text-2xl font-bold text-orange-500">Q3-Q4</span>
                    <p className="text-xs text-muted-foreground">2026</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-orange-500 mb-2">Scale</h3>
                    <ul className="grid md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <li>DAO governance</li>
                      <li>Cross-chain expansion</li>
                      <li>Enterprise features</li>
                      <li>Creator fund program</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Call to Action Slide */}
        <section className="min-h-[60vh] print:min-h-0 flex flex-col items-center justify-center text-center py-16 print:py-8 bg-gradient-to-br from-amber-500/20 via-background to-orange-500/20 rounded-3xl">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-6 shadow-xl">
            <Hexagon className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl print:text-3xl font-bold mb-4">Join the Hive</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
            Honeycomb is building the future of decentralized social, DeFi, and AI—all on BNB Chain.
          </p>
          <div className="flex flex-wrap gap-4 justify-center mb-8">
            <div className="px-6 py-3 bg-amber-500/20 rounded-xl">
              <p className="text-2xl font-bold text-amber-500">$500K</p>
              <p className="text-sm text-muted-foreground">Seed Round</p>
            </div>
            <div className="px-6 py-3 bg-orange-500/20 rounded-xl">
              <p className="text-2xl font-bold text-orange-500">BNB Chain</p>
              <p className="text-sm text-muted-foreground">Ecosystem</p>
            </div>
            <div className="px-6 py-3 bg-yellow-500/20 rounded-xl">
              <p className="text-2xl font-bold text-yellow-500">Live MVP</p>
              <p className="text-sm text-muted-foreground">Platform Ready</p>
            </div>
          </div>
          <p className="text-lg font-semibold">
            Own your hive. Build your future.
          </p>
        </section>

      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:break-after-page {
            break-after: page;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
