import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bot, Rocket, Trophy, TrendingUp, Activity, Target, Zap, 
  ArrowLeft, ExternalLink, Clock, Coins, ArrowUpRight, ArrowDownRight, Shield
} from "lucide-react";
import { ERC8004IdentityPassport } from "@/components/erc8004-identity-passport";
import { ERC8004TrustBadge } from "@/components/erc8004-trust-badge";
import { ERC8004ActivityHistory } from "@/components/erc8004-activity-history";
import { ERC8004FeedbackForm } from "@/components/erc8004-feedback-form";
import { ERC8004AgentVerification } from "@/components/erc8004-agent-verification";

interface AutonomousAgent {
  id: string;
  agentId: string;
  controllerAddress: string;
  name: string;
  description: string | null;
  strategy: string | null;
  avatarUrl: string | null;
  canDeployToken: boolean;
  canLaunch: boolean;
  canGraduate: boolean;
  canTrade: boolean;
  isActive: boolean;
  totalTokensLaunched: number;
  totalTradesExecuted: number;
  totalGraduations: number;
  totalVolumeWei: string;
  totalPnlWei: string;
  winRate: number;
  reputationScore: number;
  lastActionAt: string | null;
  createdAt: string;
}

interface AgentTokenLaunch {
  id: string;
  autonomousAgentId: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  metadataCid: string | null;
  agentNarrative: string | null;
  imageUrl: string | null;
  status: string;
  graduationTargetBnb: string;
  totalRaisedWei: string;
  createdAt: string;
  graduatedAt: string | null;
}

interface AgentTrade {
  id: string;
  autonomousAgentId: string;
  tokenAddress: string;
  isBuy: boolean;
  nativeAmountWei: string;
  tokenAmountWei: string;
  feeWei: string;
  priceAfterWei: string;
  txHash: string;
  createdAt: string;
}

interface AgentProfileData {
  agent: AutonomousAgent;
  launches: AgentTokenLaunch[];
  recentTrades: AgentTrade[];
  stats: {
    tokensLaunched: number;
    graduations: number;
    trades: number;
    volume: string;
    pnl: string;
    reputationScore: number;
  };
}

function formatBnbValue(weiValue: string): string {
  const bnb = Number(weiValue) / 1e18;
  if (bnb >= 1000) return (bnb / 1000).toFixed(2) + "K";
  if (bnb >= 1) return bnb.toFixed(4);
  return bnb.toFixed(6);
}

function formatTokenAmount(weiValue: string): string {
  const tokens = Number(weiValue) / 1e18;
  if (tokens >= 1000000) return (tokens / 1000000).toFixed(2) + "M";
  if (tokens >= 1000) return (tokens / 1000).toFixed(2) + "K";
  return tokens.toFixed(2);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "incubating":
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">Incubating</Badge>;
    case "graduated":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Graduated</Badge>;
    case "ready_to_graduate":
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">Ready</Badge>;
    case "failed":
      return <Badge className="bg-red-500/10 text-red-600 border-red-500/30">Failed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function TokenLaunchCard({ launch }: { launch: AgentTokenLaunch }) {
  const progress = Number(launch.totalRaisedWei) / Number(launch.graduationTargetBnb) * 100;

  return (
    <Link href={`/launch/${launch.tokenAddress}`}>
      <Card className="hover-elevate cursor-pointer" data-testid={`card-launch-${launch.tokenAddress}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">{launch.tokenName}</h4>
                <p className="text-sm text-muted-foreground">${launch.tokenSymbol}</p>
              </div>
            </div>
            {getStatusBadge(launch.status)}
          </div>

          {launch.agentNarrative && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{launch.agentNarrative}</p>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatBnbValue(launch.totalRaisedWei)} BNB</span>
              <span>{formatBnbValue(launch.graduationTargetBnb)} BNB target</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(launch.createdAt)}
            </span>
            {launch.graduatedAt && (
              <span className="flex items-center gap-1 text-green-600">
                <Trophy className="h-3 w-3" />
                Graduated
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function TradeRow({ trade }: { trade: AgentTrade }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0" data-testid={`trade-${trade.id}`}>
      <div className="flex items-center gap-3">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
          trade.isBuy ? "bg-green-500/10" : "bg-red-500/10"
        }`}>
          {trade.isBuy ? (
            <ArrowUpRight className="h-4 w-4 text-green-600" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-red-600" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={`font-medium ${trade.isBuy ? "text-green-600" : "text-red-600"}`}>
              {trade.isBuy ? "Buy" : "Sell"}
            </span>
            <span className="text-sm text-muted-foreground truncate max-w-[120px]">
              {trade.tokenAddress.slice(0, 8)}...
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{formatDate(trade.createdAt)}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium">{formatBnbValue(trade.nativeAmountWei)} BNB</p>
        <p className="text-xs text-muted-foreground">
          {formatTokenAmount(trade.tokenAmountWei)} tokens
        </p>
      </div>
    </div>
  );
}

export default function AgentProfilePage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery<AgentProfileData>({
    queryKey: ["/api/autonomous-agents", id],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-32 mb-8" />
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-5 w-64" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data?.agent) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <Link href="/hatchery">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agents
          </Button>
        </Link>
        <Card className="p-12 text-center">
          <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Agent Not Found</h3>
          <p className="text-muted-foreground">This autonomous agent doesn't exist or has been deactivated.</p>
        </Card>
      </div>
    );
  }

  const { agent, launches, recentTrades, stats } = data;
  const capabilities = [];
  if (agent.canDeployToken) capabilities.push("Deploy Tokens");
  if (agent.canLaunch) capabilities.push("Launch");
  if (agent.canGraduate) capabilities.push("Graduate");
  if (agent.canTrade) capabilities.push("Trade");

  // Safe parsing of agentId to BigInt for ERC-8004 integration
  let parsedAgentId: bigint | null = null;
  try {
    if (agent.agentId && /^\d+$/.test(agent.agentId)) {
      parsedAgentId = BigInt(agent.agentId);
    }
  } catch {
    parsedAgentId = null;
  }

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <Link href="/hatchery">
        <Button variant="ghost" className="mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Agents
        </Button>
      </Link>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <Avatar className="h-20 w-20 border-2">
              <AvatarImage src={agent.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-2xl">
                <Bot className="h-10 w-10 text-primary" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <CardTitle className="text-2xl" data-testid="text-agent-name">{agent.name}</CardTitle>
                {agent.isActive && (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                    <Activity className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                )}
                {parsedAgentId !== null && (
                  <ERC8004TrustBadge agentId={parsedAgentId} size="md" />
                )}
              </div>
              <CardDescription className="text-base">
                {agent.description || agent.strategy || "Autonomous AI trading agent on BNB Chain"}
              </CardDescription>
              <div className="flex flex-wrap gap-2 mt-3">
                {capabilities.map((cap) => (
                  <Badge key={cap} variant="secondary">{cap}</Badge>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-1">
                <Zap className="h-5 w-5 text-amber-500" />
                <span className="text-xl font-bold">{agent.reputationScore}</span>
                <span className="text-sm text-muted-foreground">reputation</span>
              </div>
              <a 
                href={`https://bscscan.com/address/${agent.controllerAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {agent.controllerAddress.slice(0, 8)}...{agent.controllerAddress.slice(-6)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <Rocket className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.tokensLaunched}</p>
              <p className="text-xs text-muted-foreground">Tokens Launched</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <Trophy className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.graduations}</p>
              <p className="text-xs text-muted-foreground">Graduations</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.trades}</p>
              <p className="text-xs text-muted-foreground">Trades</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <Target className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{(agent.winRate * 100).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <Coins className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{formatBnbValue(stats.volume)}</p>
              <p className="text-xs text-muted-foreground">Volume (BNB)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="launches">
        <TabsList className="mb-4">
          <TabsTrigger value="launches" data-testid="tab-launches">
            Token Launches ({launches.length})
          </TabsTrigger>
          <TabsTrigger value="trades" data-testid="tab-trades">
            Recent Trades ({recentTrades.length})
          </TabsTrigger>
          <TabsTrigger value="identity" data-testid="tab-identity">
            <Shield className="h-4 w-4 mr-1" />
            ERC-8004 Identity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="launches">
          {launches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {launches.map((launch) => (
                <TokenLaunchCard key={launch.id} launch={launch} />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Rocket className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No Token Launches Yet</h3>
              <p className="text-sm text-muted-foreground">
                This agent hasn't launched any tokens yet.
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trades">
          {recentTrades.length > 0 ? (
            <Card>
              <CardContent className="p-4">
                {recentTrades.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} />
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No Trades Yet</h3>
              <p className="text-sm text-muted-foreground">
                This agent hasn't executed any trades yet.
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="identity">
          {parsedAgentId !== null ? (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <ERC8004IdentityPassport 
                  agentId={parsedAgentId}
                  agentName={agent.name}
                  agentImage={agent.avatarUrl || undefined}
                />
              </div>
              <div className="lg:col-span-2 space-y-6">
                <ERC8004ActivityHistory 
                  agentId={parsedAgentId}
                  maxItems={5}
                />
                <ERC8004FeedbackForm 
                  agentId={parsedAgentId}
                  endpoint={`/agent/${agent.id}`}
                />
                <ERC8004AgentVerification />
              </div>
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">ERC-8004 Identity Not Available</h3>
              <p className="text-sm text-muted-foreground">
                This agent does not have a valid numeric ID for ERC-8004 identity registration.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
