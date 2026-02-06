import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useAccount } from "wagmi";
import { 
  Bot, ArrowLeft, Coins, TrendingUp, ArrowUpRight, ArrowDownRight,
  Zap, Target, RefreshCw, Clock, ExternalLink
} from "lucide-react";

interface AutonomousAgent {
  id: string;
  agentId: string;
  controllerAddress: string;
  name: string;
  avatarUrl: string | null;
  canTrade: boolean;
  isActive: boolean;
  totalVolumeWei: string;
  totalPnlWei: string;
  winRate: number;
}

interface AgentTokenLaunch {
  id: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  status: string;
  totalRaisedWei: string;
  graduationTargetBnb: string;
}

function formatBnbValue(weiValue: string): string {
  const bnb = Number(weiValue) / 1e18;
  if (bnb >= 1000) return (bnb / 1000).toFixed(2) + "K";
  if (bnb >= 1) return bnb.toFixed(4);
  return bnb.toFixed(6);
}

function TradingTokenCard({ token, agentId, canTrade }: { 
  token: AgentTokenLaunch; 
  agentId: string;
  canTrade: boolean;
}) {
  const { toast } = useToast();
  const [buyAmount, setBuyAmount] = useState("0.01");
  const [sellAmount, setSellAmount] = useState("100");
  const [isTrading, setIsTrading] = useState(false);

  const buyMutation = useMutation({
    mutationFn: async () => {
      const amountWei = (parseFloat(buyAmount) * 1e18).toString();
      return apiRequest("POST", `/api/autonomous-agents/${agentId}/queue-buy`, {
        tokenAddress: token.tokenAddress,
        amount: amountWei,
        minOut: "0"
      });
    },
    onSuccess: () => {
      toast({ title: "Buy queued successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/autonomous-agents", agentId] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to queue buy", description: error.message, variant: "destructive" });
    }
  });

  const sellMutation = useMutation({
    mutationFn: async () => {
      const tokenAmountWei = (parseFloat(sellAmount) * 1e18).toString();
      return apiRequest("POST", `/api/autonomous-agents/${agentId}/queue-sell`, {
        tokenAddress: token.tokenAddress,
        amount: tokenAmountWei,
        minOut: "0"
      });
    },
    onSuccess: () => {
      toast({ title: "Sell queued successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/autonomous-agents", agentId] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to queue sell", description: error.message, variant: "destructive" });
    }
  });

  const progress = Number(token.totalRaisedWei) / Number(token.graduationTargetBnb) * 100;

  return (
    <Card className={isTrading ? "ring-2 ring-primary" : ""} data-testid={`trading-card-${token.tokenAddress}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Link href={`/launch/${token.tokenAddress}`}>
            <div className="flex items-center gap-2 cursor-pointer hover:underline">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">{token.tokenName}</h4>
                <p className="text-sm text-muted-foreground">${token.tokenSymbol}</p>
              </div>
            </div>
          </Link>
          <Badge 
            className={token.status === 'graduated' 
              ? "bg-green-500/10 text-green-600 border-green-500/30" 
              : "bg-blue-500/10 text-blue-600 border-blue-500/30"
            }
          >
            {token.status}
          </Badge>
        </div>

        <div className="space-y-2 mb-4">
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
            <span>{formatBnbValue(token.totalRaisedWei)} BNB</span>
            <span>{formatBnbValue(token.graduationTargetBnb)} BNB target</span>
          </div>
        </div>

        {!isTrading ? (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => setIsTrading(true)}
            disabled={!canTrade || token.status === 'graduated'}
            data-testid={`button-trade-${token.tokenAddress}`}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            {canTrade ? "Trade" : "Trading Disabled"}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Buy (BNB)</Label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    value={buyAmount} 
                    onChange={(e) => setBuyAmount(e.target.value)}
                    className="h-8"
                    data-testid="input-buy-amount"
                  />
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => buyMutation.mutate()}
                    disabled={buyMutation.isPending}
                    data-testid="button-queue-buy"
                  >
                    {buyMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Sell (Tokens)</Label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    value={sellAmount} 
                    onChange={(e) => setSellAmount(e.target.value)}
                    className="h-8"
                    data-testid="input-sell-amount"
                  />
                  <Button 
                    size="sm"
                    variant="destructive"
                    onClick={() => sellMutation.mutate()}
                    disabled={sellMutation.isPending}
                    data-testid="button-queue-sell"
                  >
                    {sellMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowDownRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full"
              onClick={() => setIsTrading(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AgentTradingDashboard() {
  const { isAuthenticated } = useAuth();
  const { address } = useAccount();

  const { data: agentsData, isLoading: agentsLoading } = useQuery<{ agents: AutonomousAgent[] }>({
    queryKey: ["/api/autonomous-agents"],
  });

  const { data: tokensData, isLoading: tokensLoading } = useQuery<{ launches: AgentTokenLaunch[] }>({
    queryKey: ["/api/agent-token-launches", "incubating"],
  });

  const agents = agentsData?.agents || [];
  const tokens = tokensData?.launches || [];

  const myAgent = agents.find(a => 
    a.isActive && address && a.controllerAddress.toLowerCase() === address.toLowerCase()
  );

  if (!isAuthenticated) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <Link href="/hatchery">
          <Button variant="ghost" className="mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to AI Hatchery
          </Button>
        </Link>
        <Card className="p-12 text-center">
          <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Connect Wallet</h3>
          <p className="text-muted-foreground">Connect your wallet to access the agent trading dashboard.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <Link href="/hatchery">
        <Button variant="ghost" className="mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Hatchery
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3" data-testid="text-page-title">
          <TrendingUp className="h-8 w-8 text-primary" />
          AI Hatchery — Trading Dashboard
        </h1>
        <p className="text-muted-foreground">
          Queue autonomous trades for your AI agent to execute
        </p>
      </div>

      {myAgent && (
        <Card className="mb-6 bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{myAgent.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {myAgent.canTrade ? "Trading Enabled" : "Trading Disabled"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="font-medium">{formatBnbValue(myAgent.totalVolumeWei)}</p>
                  <p className="text-xs text-muted-foreground">Volume (BNB)</p>
                </div>
                <div className="text-center">
                  <p className="font-medium">{(myAgent.winRate * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                </div>
                <div className="flex items-center gap-1 bg-amber-500/10 px-3 py-1.5 rounded-full">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="font-bold">{formatBnbValue(myAgent.totalPnlWei)}</span>
                  <span className="text-xs text-muted-foreground ml-1">PnL</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="tokens">
        <TabsList className="mb-4">
          <TabsTrigger value="tokens" data-testid="tab-tokens">
            <Coins className="h-4 w-4 mr-2" />
            Tradeable Tokens ({tokens.length})
          </TabsTrigger>
          <TabsTrigger value="queue" data-testid="tab-queue">
            <Clock className="h-4 w-4 mr-2" />
            Queue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tokens">
          {tokensLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div>
                        <Skeleton className="h-5 w-24 mb-1" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-2 w-full mb-4" />
                    <Skeleton className="h-9 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : tokens.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tokens.map((token) => (
                <TradingTokenCard 
                  key={token.id} 
                  token={token} 
                  agentId={myAgent?.id || ""} 
                  canTrade={myAgent?.canTrade || false}
                />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No Active Tokens</h3>
              <p className="text-sm text-muted-foreground">
                There are no tokens available for trading right now.
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="queue">
          <Card className="p-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">Trade Queue</h3>
            <p className="text-sm text-muted-foreground">
              Queued trades will appear here. The agent runtime processes trades autonomously.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
