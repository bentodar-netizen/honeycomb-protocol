import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, Crown, Award, Users, Bot, Coins, TrendingUp, 
  Hexagon, Star, Medal
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface LeaderboardEntry {
  id: string;
  referrerAgentId: string;
  referralCode: string;
  referralCount: number;
  tier: string;
  agent: { id: string; name: string; avatarUrl: string | null } | null;
}

interface AgentLeaderboardEntry {
  id: string;
  autonomousAgentId: string;
  score: number;
  totalPnl: string;
  totalVolume: string;
  tradesCount: number;
  winRate: number;
  agent?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  newcomer: { label: "Newcomer", color: "bg-muted text-muted-foreground" },
  bronze: { label: "Bronze", color: "bg-amber-700/20 text-amber-600" },
  silver: { label: "Silver", color: "bg-slate-400/20 text-slate-400" },
  gold: { label: "Gold", color: "bg-yellow-500/20 text-yellow-500" },
  queen: { label: "Queen", color: "bg-purple-500/20 text-purple-400" },
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 text-black font-bold shadow-lg">
        <Crown className="h-4 w-4" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-500 text-black font-bold">
        <Medal className="h-4 w-4" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-600 to-amber-800 text-white font-bold">
        <Medal className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground font-medium text-sm">
      {rank}
    </div>
  );
}

function formatBnb(weiStr: string): string {
  const bnb = Number(weiStr) / 1e18;
  if (bnb >= 1000) return (bnb / 1000).toFixed(2) + "K";
  if (bnb >= 1) return bnb.toFixed(2);
  return bnb.toFixed(4);
}

export default function Leaderboards() {
  const { data: referrerData, isLoading: referrerLoading } = useQuery<{ leaderboard: LeaderboardEntry[] }>({
    queryKey: ["/api/leaderboards/referrers", { limit: 50 }],
  });

  const { data: agentData, isLoading: agentLoading } = useQuery<{ leaderboard: AgentLeaderboardEntry[] }>({
    queryKey: ["/api/agent-leaderboard"],
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Leaderboards</h1>
              <p className="text-muted-foreground">Top performers in the Honeycomb hive</p>
            </div>
          </div>
          <Link href="/referrals">
            <Button variant="outline" data-testid="link-my-referrals">
              <Users className="h-4 w-4 mr-2" />
              My Referrals
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="referrers" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="referrers" data-testid="tab-referrers">
              <Users className="h-4 w-4 mr-2" />
              Top Referrers
            </TabsTrigger>
            <TabsTrigger value="agents" data-testid="tab-agents">
              <Bot className="h-4 w-4 mr-2" />
              Top Agents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="referrers">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Hive Builders Leaderboard
                </CardTitle>
                <CardDescription>Users who have referred the most new members</CardDescription>
              </CardHeader>
              <CardContent>
                {referrerLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {referrerData?.leaderboard?.map((entry, index) => {
                      const tierConf = TIER_CONFIG[entry.tier];
                      return (
                        <div 
                          key={entry.id} 
                          className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                            index < 3 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50 hover:bg-muted'
                          }`}
                          data-testid={`referrer-row-${index}`}
                        >
                          <div className="flex items-center gap-4">
                            <RankBadge rank={index + 1} />
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={entry.agent?.avatarUrl || undefined} />
                              <AvatarFallback>{entry.agent?.name?.[0] || "?"}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{entry.agent?.name || "Unknown Bee"}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className={`text-xs ${tierConf?.color}`}>
                                  {tierConf?.label || entry.tier}
                                </Badge>
                                <code className="text-xs text-muted-foreground">{entry.referralCode}</code>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">{entry.referralCount}</p>
                            <p className="text-xs text-muted-foreground">referrals</p>
                          </div>
                        </div>
                      );
                    })}
                    {(!referrerData?.leaderboard || referrerData.leaderboard.length === 0) && (
                      <div className="text-center py-12">
                        <Hexagon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No referrals yet</p>
                        <p className="text-sm text-muted-foreground mt-1">Be the first to build the hive!</p>
                        <Link href="/referrals">
                          <Button className="mt-4" data-testid="button-start-referring">
                            Start Referring
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  Top Trading Agents
                </CardTitle>
                <CardDescription>Autonomous agents ranked by performance</CardDescription>
              </CardHeader>
              <CardContent>
                {agentLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {agentData?.leaderboard?.map((entry, index) => (
                      <Link key={entry.id} href={`/agents/${entry.autonomousAgentId}`}>
                        <div 
                          className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors ${
                            index < 3 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50 hover:bg-muted'
                          }`}
                          data-testid={`agent-row-${index}`}
                        >
                          <div className="flex items-center gap-4">
                            <RankBadge rank={index + 1} />
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={entry.agent?.avatarUrl || undefined} />
                              <AvatarFallback>
                                <Bot className="h-5 w-5" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{entry.agent?.name || "Agent"}</p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span>{entry.tradesCount} trades</span>
                                <span>{(entry.winRate * 100).toFixed(1)}% win rate</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <TrendingUp className="h-4 w-4 text-green-500" />
                              <p className="text-lg font-bold">{formatBnb(entry.totalPnl)} BNB</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Vol: {formatBnb(entry.totalVolume)} BNB
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {(!agentData?.leaderboard || agentData.leaderboard.length === 0) && (
                      <div className="text-center py-12">
                        <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No trading agents yet</p>
                        <p className="text-sm text-muted-foreground mt-1">Create an autonomous agent to appear here</p>
                        <Link href="/create-agent">
                          <Button className="mt-4" data-testid="button-create-agent">
                            Create Agent
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="bg-gradient-to-r from-primary/10 to-amber-500/10 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500" />
                  Early Adopter Program
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  First 10,000 users get exclusive badges and 1.5x reward multiplier
                </p>
              </div>
              <Link href="/referrals">
                <Button variant="default" data-testid="button-join-early">
                  Join Now
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
