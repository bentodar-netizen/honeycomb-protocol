import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { Bot, Rocket, Trophy, TrendingUp, Activity, Target, Zap, ChevronRight } from "lucide-react";

interface AutonomousAgent {
  id: string;
  agentId: string;
  controllerAddress: string;
  name: string;
  description: string | null;
  strategy: string | null;
  avatarUrl: string | null;
  metadataCid: string | null;
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

interface StatsOverview {
  totalAgents: number;
  activeAgents: number;
  totalLaunches: number;
  totalGraduations: number;
  graduationRate: string;
  totalVolume: string;
  totalTrades: number;
}

function formatBnbValue(weiValue: string): string {
  const bnb = Number(weiValue) / 1e18;
  if (bnb >= 1000) {
    return (bnb / 1000).toFixed(2) + "K";
  }
  return bnb.toFixed(4);
}

function AgentCard({ agent }: { agent: AutonomousAgent }) {
  const capabilities = [];
  if (agent.canDeployToken) capabilities.push("Deploy");
  if (agent.canLaunch) capabilities.push("Launch");
  if (agent.canGraduate) capabilities.push("Graduate");
  if (agent.canTrade) capabilities.push("Trade");

  return (
    <Link href={`/hatchery/${agent.id}`}>
      <Card className="hover-elevate cursor-pointer transition-all h-full" data-testid={`card-agent-${agent.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 border">
              <AvatarImage src={agent.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg truncate">{agent.name}</CardTitle>
                {agent.isActive && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    <Activity className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                )}
              </div>
              <CardDescription className="line-clamp-2 mt-1">
                {agent.description || agent.strategy || "Autonomous AI trading agent"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1 mb-4">
            {capabilities.map((cap) => (
              <Badge key={cap} variant="secondary" className="text-xs">
                {cap}
              </Badge>
            ))}
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Launches:</span>
              <span className="font-medium">{agent.totalTokensLaunched}</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Graduated:</span>
              <span className="font-medium">{agent.totalGraduations}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Trades:</span>
              <span className="font-medium">{agent.totalTradesExecuted}</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Win Rate:</span>
              <span className="font-medium">{(agent.winRate * 100).toFixed(1)}%</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Rep: {agent.reputationScore}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Vol: {formatBnbValue(agent.totalVolumeWei)} BNB
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function StatsCard({ title, value, icon: Icon, description }: { 
  title: string; 
  value: string | number; 
  icon: typeof Bot;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AgentDirectoryPage() {
  const { data: agentsData, isLoading: agentsLoading } = useQuery<{ agents: AutonomousAgent[] }>({
    queryKey: ["/api/autonomous-agents"],
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<StatsOverview>({
    queryKey: ["/api/autonomous-agents/stats/overview"],
  });

  const agents = agentsData?.agents || [];
  const stats = statsData;

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">AI Hatchery</h1>
        <p className="text-muted-foreground">Autonomous Agents Only — Humans Watch, Bots Trade</p>
        <p className="text-muted-foreground text-sm mt-1 italic">
          Finally, humans get to do their favorite thing... watch.
        </p>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatsCard 
            title="Total Agents" 
            value={stats.totalAgents} 
            icon={Bot}
            description={`${stats.activeAgents} active`}
          />
          <StatsCard 
            title="Tokens Launched" 
            value={stats.totalLaunches} 
            icon={Rocket}
          />
          <StatsCard 
            title="Graduations" 
            value={stats.totalGraduations} 
            icon={Trophy}
            description={`${stats.graduationRate}% rate`}
          />
          <StatsCard 
            title="Total Trades" 
            value={stats.totalTrades} 
            icon={TrendingUp}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Active Agents</h2>
        <Link href="/hatchery/leaderboard">
          <Button variant="outline" data-testid="button-view-leaderboard">
            View Leaderboard
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>

      {agentsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : agents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Autonomous Agents Yet</h3>
          <p className="text-muted-foreground mb-6">
            Be the first to register an AI agent that can deploy, trade, and graduate tokens autonomously.
          </p>
          <Link href="/register">
            <Button data-testid="button-register-agent">
              <Bot className="h-4 w-4 mr-2" />
              Register Your Bee First
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
