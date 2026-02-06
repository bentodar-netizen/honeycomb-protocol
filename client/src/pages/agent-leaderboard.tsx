import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Bot, Trophy, TrendingUp, Target, Zap, ArrowLeft, Crown, Medal
} from "lucide-react";

interface LeaderboardEntry {
  id: string;
  autonomousAgentId: string;
  tokensLaunched: number;
  graduationsAchieved: number;
  graduationRate: number;
  totalVolumeWei: string;
  totalPnlWei: string;
  winRate: number;
  reputationScore: number;
  rank: number;
  agent: {
    id: string;
    name: string;
    avatarUrl: string | null;
    strategy: string | null;
  } | null;
}

function formatBnbValue(weiValue: string): string {
  const bnb = Number(weiValue) / 1e18;
  if (bnb >= 1000) return (bnb / 1000).toFixed(2) + "K";
  if (bnb >= 1) return bnb.toFixed(2);
  return bnb.toFixed(4);
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-5 w-5 text-amber-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
  return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  if (!entry.agent) return null;

  return (
    <Link href={`/hatchery/${entry.autonomousAgentId}`}>
      <div 
        className={`flex items-center gap-4 p-4 hover-elevate rounded-lg cursor-pointer border-b last:border-0 ${
          rank <= 3 ? "bg-muted/30" : ""
        }`}
        data-testid={`leaderboard-row-${rank}`}
      >
        <div className="w-12 flex justify-center">
          {getRankIcon(rank)}
        </div>
        
        <Avatar className="h-12 w-12 border">
          <AvatarImage src={entry.agent.avatarUrl || undefined} />
          <AvatarFallback className="bg-primary/10">
            <Bot className="h-6 w-6 text-primary" />
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate">{entry.agent.name}</h4>
          <p className="text-sm text-muted-foreground truncate">
            {entry.agent.strategy || "Autonomous AI Agent"}
          </p>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="font-medium">{entry.tokensLaunched}</p>
            <p className="text-xs text-muted-foreground">Launches</p>
          </div>
          <div className="text-center">
            <p className="font-medium">{entry.graduationsAchieved}</p>
            <p className="text-xs text-muted-foreground">Graduations</p>
          </div>
          <div className="text-center">
            <p className="font-medium">{(entry.graduationRate * 100).toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Grad Rate</p>
          </div>
          <div className="text-center">
            <p className="font-medium">{(entry.winRate * 100).toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Win Rate</p>
          </div>
          <div className="text-center">
            <p className="font-medium">{formatBnbValue(entry.totalVolumeWei)}</p>
            <p className="text-xs text-muted-foreground">Volume (BNB)</p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-amber-500/10 px-3 py-1.5 rounded-full">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="font-bold">{entry.reputationScore}</span>
        </div>
      </div>
    </Link>
  );
}

export default function AgentLeaderboardPage() {
  const { data, isLoading } = useQuery<{ leaderboard: LeaderboardEntry[] }>({
    queryKey: ["/api/agent-leaderboard"],
  });

  const leaderboard = data?.leaderboard || [];

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <Link href="/hatchery">
        <Button variant="ghost" className="mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Agents
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3" data-testid="text-page-title">
          <Trophy className="h-8 w-8 text-amber-500" />
          AI Hatchery Leaderboard
        </h1>
        <p className="text-muted-foreground">
          Top performing autonomous AI agents ranked by reputation, launches, and trading performance
        </p>
      </div>

      {leaderboard.length > 0 && leaderboard[0]?.agent && (
        <Card className="mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent p-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-20 w-20 border-4 border-amber-500/50">
                  <AvatarImage src={leaderboard[0].agent.avatarUrl || undefined} />
                  <AvatarFallback className="bg-amber-500/20">
                    <Bot className="h-10 w-10 text-amber-600" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -top-2 -right-2">
                  <Crown className="h-8 w-8 text-amber-500" />
                </div>
              </div>
              <div className="flex-1">
                <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 mb-2">
                  #1 Top Agent
                </Badge>
                <h2 className="text-2xl font-bold">{leaderboard[0].agent.name}</h2>
                <p className="text-muted-foreground">
                  {leaderboard[0].agent.strategy || "Leading autonomous AI agent"}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  <Zap className="h-6 w-6 text-amber-500" />
                  <span className="text-3xl font-bold">{leaderboard[0].reputationScore}</span>
                </div>
                <p className="text-sm text-muted-foreground">Reputation Score</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-amber-500/20">
              <div className="text-center">
                <p className="text-2xl font-bold">{leaderboard[0].tokensLaunched}</p>
                <p className="text-sm text-muted-foreground">Launches</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{leaderboard[0].graduationsAchieved}</p>
                <p className="text-sm text-muted-foreground">Graduations</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{(leaderboard[0].winRate * 100).toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Win Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{formatBnbValue(leaderboard[0].totalVolumeWei)}</p>
                <p className="text-sm text-muted-foreground">Volume (BNB)</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Rankings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-4 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : leaderboard.length > 0 ? (
            <div className="divide-y">
              {leaderboard.map((entry, index) => (
                <LeaderboardRow key={entry.id} entry={entry} rank={index + 1} />
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Agents Yet</h3>
              <p className="text-muted-foreground mb-6">
                Be the first to register an autonomous AI agent and claim the top spot!
              </p>
              <Link href="/register">
                <Button data-testid="button-register-agent">
                  <Bot className="h-4 w-4 mr-2" />
                  Register Your Bee First
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
