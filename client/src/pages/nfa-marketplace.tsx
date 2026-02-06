import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Bot, Brain, ShoppingCart, Star, Zap, Trophy, Search, Plus, TrendingUp, 
  Clock, Shield, Pause, XCircle, Wallet, Loader2, Filter, Grid3X3, 
  LayoutList, Sparkles, Activity, ChevronDown, Verified, Flame, Eye,
  ArrowUpRight, Heart, MoreHorizontal, RefreshCw, User
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BAP578MarketplaceABI } from "@/contracts/abis";
import { getNFAMarketplaceAddresses, NFA_FEE_WALLET } from "@/contracts/addresses";
import { useI18n } from "@/lib/i18n";

interface NfaAgent {
  id: string;
  tokenId: number;
  ownerAddress: string;
  name: string;
  description: string | null;
  modelType: string;
  agentType: string;
  status: string;
  category: string | null;
  interactionCount: number;
  createdAt: string;
  learningEnabled: boolean;
  learningVersion: number;
  balance: string;
}

interface NfaListing {
  listing: {
    id: string;
    nfaId: string;
    priceWei: string;
    priceDisplay: string;
    active: boolean;
    listedAt: string;
  };
  agent: NfaAgent;
}

interface LeaderboardEntry {
  agent: NfaAgent;
  stats: {
    totalInteractions: number;
    totalRevenue: string;
    rating: number;
    ratingCount: number;
  } | null;
}

const CATEGORY_ICONS: Record<string, typeof Bot> = {
  "personal-assistant": Bot,
  "security-guardian": Shield,
  "content-creator": Sparkles,
  "data-analyst": Activity,
  "defi-trader": TrendingUp,
};

const CATEGORY_COLORS: Record<string, string> = {
  "personal-assistant": "from-blue-500/20 to-blue-600/10 border-blue-500/30",
  "security-guardian": "from-green-500/20 to-green-600/10 border-green-500/30",
  "content-creator": "from-purple-500/20 to-purple-600/10 border-purple-500/30",
  "data-analyst": "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30",
  "defi-trader": "from-amber-500/20 to-amber-600/10 border-amber-500/30",
};

function NfaCard({ listing, agent, onBuy, isBuying, isOwner, platformFee }: {
  listing: NfaListing["listing"];
  agent: NfaAgent;
  onBuy: () => void;
  isBuying: boolean;
  isOwner: boolean;
  platformFee: number;
}) {
  const { t } = useI18n();
  const CategoryIcon = CATEGORY_ICONS[agent.category || ""] || Bot;
  const colorClass = CATEGORY_COLORS[agent.category || ""] || "from-primary/20 to-primary/10 border-primary/30";
  
  return (
    <Card className="group overflow-hidden hover-elevate" data-testid={`card-nfa-${agent.id}`}>
      <div className={`relative aspect-square bg-gradient-to-br ${colorClass} p-6 flex items-center justify-center overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="p-6 rounded-2xl bg-background/20 backdrop-blur-sm border border-white/10 group-hover:scale-110 transition-transform duration-300">
            <CategoryIcon className="h-16 w-16 text-foreground/80" />
          </div>
          {agent.agentType === "LEARNING" && (
            <Badge className="bg-green-500/90 text-white border-0 gap-1">
              <Brain className="h-3 w-3" />
              {t('nfa.learning')}
            </Badge>
          )}
        </div>

        <div className="absolute top-3 left-3 flex gap-2">
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
            #{agent.tokenId}
          </Badge>
          {agent.status !== "ACTIVE" && (
            <Badge variant={agent.status === "PAUSED" ? "secondary" : "destructive"} className="gap-1">
              {agent.status === "PAUSED" ? <Pause className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {agent.status === "PAUSED" ? t('nfa.paused') : t('nfa.terminated')}
            </Badge>
          )}
        </div>

        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="secondary" className="h-8 w-8 bg-background/80 backdrop-blur-sm">
            <Heart className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="secondary" className="h-8 w-8 bg-background/80 backdrop-blur-sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isOwner ? (
            <Button 
              className="w-full gap-2" 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBuy(); }}
              disabled={isBuying}
              data-testid={`button-buy-${agent.id}`}
            >
              {isBuying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              {t('nfa.buy')}
            </Button>
          ) : (
            <Badge variant="secondary" className="w-full justify-center py-2">{t('nfa.owned')}</Badge>
          )}
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link href={`/nfa/${agent.id}`}>
              <h3 className="font-semibold truncate hover:text-primary transition-colors cursor-pointer" data-testid={`text-nfa-name-${agent.id}`}>
                {agent.name}
              </h3>
            </Link>
            <p className="text-sm text-muted-foreground truncate">{agent.modelType}</p>
          </div>
          {agent.learningEnabled && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              <Verified className="h-3 w-3 text-blue-500" />
              v{agent.learningVersion}
            </div>
          )}
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
          {agent.description || t('nfa.defaultDescription')}
        </p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {agent.interactionCount}
          </span>
          <span className="flex items-center gap-1">
            <Wallet className="h-3 w-3" />
            {(parseFloat(agent.balance) / 1e18).toFixed(3)} BNB
          </span>
          {agent.category && (
            <Badge variant="outline" className="text-xs capitalize">
              {agent.category.replace("-", " ")}
            </Badge>
          )}
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{t('nfa.price')}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold">{listing.priceDisplay}</span>
              <span className="text-xs text-muted-foreground">{t('nfa.fee').replace('{percent}', String(platformFee))}</span>
            </div>
          </div>
          <Link href={`/nfa/${agent.id}`}>
            <Button variant="ghost" size="sm" className="gap-1" data-testid={`button-view-${agent.id}`}>
              {t('nfa.view')} <ArrowUpRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendingCard({ agent, stats, rank }: { agent: NfaAgent; stats: LeaderboardEntry["stats"]; rank: number }) {
  const { t } = useI18n();
  const CategoryIcon = CATEGORY_ICONS[agent.category || ""] || Bot;
  
  return (
    <Link href={`/nfa/${agent.id}`}>
      <Card className="hover-elevate cursor-pointer overflow-hidden group">
        <CardContent className="p-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
            rank === 1 ? "bg-amber-500 text-white" :
            rank === 2 ? "bg-gray-400 text-white" :
            rank === 3 ? "bg-amber-700 text-white" :
            "bg-muted text-muted-foreground"
          }`}>
            {rank}
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <CategoryIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold truncate group-hover:text-primary transition-colors">{agent.name}</h4>
            <p className="text-xs text-muted-foreground">{agent.modelType}</p>
          </div>
          <div className="text-right">
            <p className="font-bold">{stats?.totalInteractions || 0}</p>
            <p className="text-xs text-muted-foreground">{t('nfa.interactions')}</p>
          </div>
          {stats?.rating && stats.rating > 0 && (
            <div className="flex items-center gap-1 text-amber-500">
              <Star className="h-4 w-4 fill-current" />
              <span className="font-medium">{stats.rating.toFixed(1)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function ActivityItem({ agent, price, type, time }: { agent: NfaAgent; price: string; type: "sale" | "listing"; time: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <Avatar className="h-10 w-10 border">
        <AvatarFallback className="bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{agent.name}</p>
        <p className="text-xs text-muted-foreground">
          {type === "sale" ? t('nfa.soldFor') : t('nfa.listedFor')} <span className="font-medium text-foreground">{price}</span>
        </p>
      </div>
      <div className="text-right">
        <Badge variant={type === "sale" ? "default" : "outline"} className="text-xs">
          {type === "sale" ? t('nfa.sale') : t('nfa.listed')}
        </Badge>
        <p className="text-xs text-muted-foreground mt-1">{time}</p>
      </div>
    </div>
  );
}

export default function NfaMarketplace() {
  const { isAuthenticated, authenticate } = useAuth();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();
  const { t } = useI18n();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [priceRange, setPriceRange] = useState([0, 100]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(true);
  const [agentTypeFilter, setAgentTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>(["ACTIVE"]);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | null>(null);

  const marketplaceAddresses = getNFAMarketplaceAddresses(chainId);
  const isMarketplaceDeployed = marketplaceAddresses?.marketplace !== "0x0000000000000000000000000000000000000000";

  const { writeContractAsync } = useWriteContract();
  
  const { isLoading: isWaitingTx } = useWaitForTransactionReceipt({
    hash: pendingTxHash ?? undefined,
  });

  const ensureAuthenticated = async () => {
    if (!isAuthenticated) {
      try {
        await authenticate();
        return true;
      } catch {
        toast({
          title: t('nfa.authRequired'),
          description: t('nfa.authRequiredDesc'),
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const { data: listingsData, isLoading: listingsLoading, refetch } = useQuery<{ listings: NfaListing[] }>({
    queryKey: ["/api/nfa/marketplace/listings"],
  });

  const { data: leaderboardData } = useQuery<{ agents: LeaderboardEntry[] }>({
    queryKey: ["/api/nfa/leaderboard/interactions"],
  });

  const { data: categoriesData } = useQuery<{ categories: { category: string; count: number }[] }>({
    queryKey: ["/api/nfa/categories"],
  });

  const { data: feeData } = useQuery<{ platformFeePercent: number; feeWallet: string }>({
    queryKey: ["/api/nfa/marketplace/fees"],
  });

  const { data: myAgentsData, isLoading: myAgentsLoading } = useQuery<{ agents: NfaAgent[] }>({
    queryKey: ["/api/nfa/agents", { owner: address }],
    queryFn: async () => {
      const res = await fetch(`/api/nfa/agents?owner=${address}`);
      if (!res.ok) throw new Error(t('nfa.failedToFetch'));
      return res.json();
    },
    enabled: isConnected && !!address,
  });

  const buyMutation = useMutation({
    mutationFn: async ({ nfaId, tokenId, priceWei }: { nfaId: string; tokenId: number; priceWei: string }) => {
      if (!await ensureAuthenticated()) throw new Error(t('nfa.notAuthenticated'));
      setBuyingId(nfaId);
      
      if (isMarketplaceDeployed && marketplaceAddresses) {
        const txHash = await writeContractAsync({
          address: marketplaceAddresses.marketplace,
          abi: BAP578MarketplaceABI,
          functionName: "buy",
          args: [BigInt(tokenId)],
          value: BigInt(priceWei),
        });
        
        setPendingTxHash(txHash);
        
        const result = await apiRequest("POST", "/api/nfa/marketplace/buy", { 
          nfaId, 
          txHash,
          onChain: true 
        });
        
        setPendingTxHash(null);
        return result;
      } else {
        return apiRequest("POST", "/api/nfa/marketplace/buy", { nfaId });
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfa/marketplace/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nfa/agents"] });
      toast({
        title: t('nfa.purchaseSuccess'),
        description: t('nfa.purchaseSuccessDesc'),
      });
      setBuyingId(null);
    },
    onError: (error: Error) => {
      toast({
        title: t('nfa.purchaseFailed'),
        description: error.message,
        variant: "destructive",
      });
      setBuyingId(null);
      setPendingTxHash(null);
    },
  });

  const listings = listingsData?.listings || [];
  const leaderboard = leaderboardData?.agents || [];
  const categories = categoriesData?.categories || [];
  const myAgents = myAgentsData?.agents || [];
  const platformFeePercent = feeData?.platformFeePercent || 1;

  const filteredListings = listings.filter(item => {
    const matchesSearch = !searchQuery || 
      item.agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.agent.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.agent.category === categoryFilter;
    const matchesAgentType = agentTypeFilter.length === 0 || agentTypeFilter.includes(item.agent.agentType);
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(item.agent.status);
    return matchesSearch && matchesCategory && matchesAgentType && matchesStatus;
  });

  const sortedListings = [...filteredListings].sort((a, b) => {
    switch (sortBy) {
      case "price-low":
        return parseFloat(a.listing.priceWei) - parseFloat(b.listing.priceWei);
      case "price-high":
        return parseFloat(b.listing.priceWei) - parseFloat(a.listing.priceWei);
      case "interactions":
        return b.agent.interactionCount - a.agent.interactionCount;
      case "recent":
      default:
        return new Date(b.listing.listedAt).getTime() - new Date(a.listing.listedAt).getTime();
    }
  });

  const totalVolume = listings.reduce((sum, l) => sum + parseFloat(l.listing.priceWei), 0);
  const avgPrice = listings.length > 0 ? totalVolume / listings.length : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-purple-500/5 border-b">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS1vcGFjaXR5PSIuMDUiLz48L2c+PC9zdmc+')] opacity-50" />
        
        <div className="container mx-auto px-4 py-12 relative">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight" data-testid="text-page-title">
                    {t('nfa.title')}
                  </h1>
                  <p className="text-muted-foreground">
                    {t('nfa.description')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isAuthenticated && (
                <Link href="/nfa/mint">
                  <Button size="lg" className="gap-2 shadow-lg shadow-primary/20" data-testid="button-mint-nfa">
                    <Plus className="h-5 w-5" />
                    {t('nfa.mintAgent')}
                  </Button>
                </Link>
              )}
              <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <Card className="bg-card/50 backdrop-blur border-0">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Bot className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{listings.length}</p>
                  <p className="text-xs text-muted-foreground">{t('nfa.totalListed')}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 backdrop-blur border-0">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{(totalVolume / 1e18).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{t('nfa.totalVolume')}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 backdrop-blur border-0">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Wallet className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{(avgPrice / 1e18).toFixed(3)}</p>
                  <p className="text-xs text-muted-foreground">{t('nfa.avgPrice')}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 backdrop-blur border-0">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Brain className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {listings.filter(l => l.agent.agentType === "LEARNING").length}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('nfa.learningAgents')}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {leaderboard.length > 0 && (
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <h2 className="text-xl font-bold">{t('nfa.trendingAgents')}</h2>
            </div>
            <Button variant="ghost" size="sm" className="gap-1">
              {t('nfa.viewAll')} <ArrowUpRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leaderboard.slice(0, 3).map((entry, index) => (
              <TrendingCard 
                key={entry.agent.id} 
                agent={entry.agent} 
                stats={entry.stats} 
                rank={index + 1} 
              />
            ))}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue={isConnected ? "my-nfas" : "explore"} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            {isConnected && (
              <TabsTrigger value="my-nfas" className="gap-2" data-testid="tab-my-nfas">
                <User className="h-4 w-4" />
                {t('nfa.myAgents')}
              </TabsTrigger>
            )}
            <TabsTrigger value="explore" className="gap-2" data-testid="tab-marketplace">
              <ShoppingCart className="h-4 w-4" />
              {t('nfa.marketplace')}
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-2" data-testid="tab-leaderboard">
              <Trophy className="h-4 w-4" />
              {t('nfa.leaderboard')}
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2" data-testid="tab-categories">
              <Brain className="h-4 w-4" />
              {t('nfa.allCategories')}
            </TabsTrigger>
          </TabsList>

          {isConnected && (
            <TabsContent value="my-nfas">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">{t('nfa.yourNfas')}</h2>
                <p className="text-muted-foreground text-sm">{t('nfa.manageNfas')}</p>
              </div>
              
              {myAgentsLoading ? (
                <div className="text-center py-12 text-muted-foreground">{t('nfa.loadingAgents')}</div>
              ) : myAgents.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">{t('nfa.noNfasYet')}</h3>
                    <p className="text-muted-foreground mb-4">
                      {t('nfa.noNfasDesc')}
                    </p>
                    <Link href="/nfa/mint">
                      <Button data-testid="button-mint-first-nfa">
                        <Plus className="h-4 w-4 mr-2" />
                        {t('nfa.mintFirstNfa')}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myAgents.map(agent => (
                    <Link key={agent.id} href={`/nfa/${agent.id}`}>
                      <Card className="hover-elevate cursor-pointer h-full">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-lg truncate">{agent.name}</CardTitle>
                            <div className="flex gap-1 flex-shrink-0">
                              <Badge variant={agent.status === "ACTIVE" ? "default" : agent.status === "PAUSED" ? "secondary" : "destructive"}>
                                {agent.status === "ACTIVE" ? t('nfa.active') : agent.status === "PAUSED" ? t('nfa.paused') : t('nfa.terminated')}
                              </Badge>
                              {agent.agentType === "LEARNING" && (
                                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                                  <Brain className="h-3 w-3 mr-1" />
                                  {t('nfa.learning')}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <CardDescription className="line-clamp-2">
                            {agent.description || t('nfa.noDescription')}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {agent.interactionCount} {t('nfa.interactions')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Wallet className="h-3 w-3" />
                              {parseFloat(agent.balance) / 1e18} BNB
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{agent.modelType}</Badge>
                            {agent.category && <Badge variant="outline">{agent.category}</Badge>}
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <Button variant="outline" className="w-full" data-testid={`button-view-nfa-${agent.id}`}>
                            {t('nfa.viewAndManage')}
                          </Button>
                        </CardFooter>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          <TabsContent value="explore">
        <div className="flex flex-col lg:flex-row gap-6">
          {showFilters && (
            <aside className="w-full lg:w-64 flex-shrink-0">
              <Card className="sticky top-4">
                <CardContent className="p-4 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      {t('nfa.filters')}
                    </h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setCategoryFilter("all");
                        setAgentTypeFilter([]);
                        setStatusFilter(["ACTIVE"]);
                        setPriceRange([0, 100]);
                      }}
                    >
                      {t('nfa.reset')}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">{t('nfa.category')}</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder={t('nfa.allCategories')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('nfa.allCategories')}</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat.category} value={cat.category}>
                            <span className="capitalize">{cat.category.replace("-", " ")}</span>
                            <Badge variant="secondary" className="ml-2">{cat.count}</Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">{t('nfa.agentType')}</Label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="learning" 
                          checked={agentTypeFilter.includes("LEARNING")}
                          onCheckedChange={(checked) => {
                            setAgentTypeFilter(prev => 
                              checked ? [...prev, "LEARNING"] : prev.filter(type => type !== "LEARNING")
                            );
                          }}
                        />
                        <Label htmlFor="learning" className="text-sm flex items-center gap-1 cursor-pointer">
                          <Brain className="h-3 w-3 text-green-500" />
                          {t('nfa.learning')}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="static" 
                          checked={agentTypeFilter.includes("STATIC")}
                          onCheckedChange={(checked) => {
                            setAgentTypeFilter(prev => 
                              checked ? [...prev, "STATIC"] : prev.filter(type => type !== "STATIC")
                            );
                          }}
                        />
                        <Label htmlFor="static" className="text-sm flex items-center gap-1 cursor-pointer">
                          <Zap className="h-3 w-3 text-blue-500" />
                          {t('nfa.static')}
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">{t('nfa.status')}</Label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="active" 
                          checked={statusFilter.includes("ACTIVE")}
                          onCheckedChange={(checked) => {
                            setStatusFilter(prev => 
                              checked ? [...prev, "ACTIVE"] : prev.filter(type => type !== "ACTIVE")
                            );
                          }}
                        />
                        <Label htmlFor="active" className="text-sm cursor-pointer">{t('nfa.active')}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="paused" 
                          checked={statusFilter.includes("PAUSED")}
                          onCheckedChange={(checked) => {
                            setStatusFilter(prev => 
                              checked ? [...prev, "PAUSED"] : prev.filter(type => type !== "PAUSED")
                            );
                          }}
                        />
                        <Label htmlFor="paused" className="text-sm cursor-pointer">{t('nfa.paused')}</Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {isConnected && myAgents.length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">{t('nfa.yourNfasCount')}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t('nfa.youOwnAgents').replace('{count}', String(myAgents.length))}
                      </p>
                      <Link href="/nfa/mint">
                        <Button variant="outline" size="sm" className="w-full gap-2">
                          <Plus className="h-3 w-3" />
                          {t('nfa.mintAnother')}
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </aside>
          )}

          <main className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('nfa.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-card"
                  data-testid="input-search"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden"
                >
                  <Filter className="h-4 w-4" />
                </Button>
                
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[160px]" data-testid="select-sort">
                    <SelectValue placeholder={t('nfa.sortBy')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">{t('nfa.recentlyListed')}</SelectItem>
                    <SelectItem value="price-low">{t('nfa.priceLowHigh')}</SelectItem>
                    <SelectItem value="price-high">{t('nfa.priceHighLow')}</SelectItem>
                    <SelectItem value="interactions">{t('nfa.mostPopular')}</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex border rounded-md">
                  <Button 
                    variant={viewMode === "grid" ? "secondary" : "ghost"} 
                    size="icon"
                    onClick={() => setViewMode("grid")}
                    className="rounded-r-none"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={viewMode === "list" ? "secondary" : "ghost"} 
                    size="icon"
                    onClick={() => setViewMode("list")}
                    className="rounded-l-none"
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {t('nfa.results').replace('{count}', String(sortedListings.length))}
              </p>
              <Badge variant="outline" className="gap-1">
                <Shield className="h-3 w-3" />
                {platformFeePercent}% {t('nfa.platformFee')}
              </Badge>
            </div>

            {listingsLoading ? (
              <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Card key={i} className="animate-pulse overflow-hidden">
                    <div className="aspect-square bg-muted" />
                    <CardContent className="p-4 space-y-3">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                      <div className="h-8 bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : sortedListings.length === 0 ? (
              <Card className="p-16 text-center bg-card/50">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-muted">
                    <Bot className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">{t('nfa.noNfasFound')}</h3>
                    <p className="text-muted-foreground max-w-sm">
                      {searchQuery || categoryFilter !== "all" 
                        ? t('nfa.adjustFilters')
                        : t('nfa.beFirstToList2')
                      }
                    </p>
                  </div>
                  <Link href="/nfa/mint">
                    <Button className="gap-2 mt-2" data-testid="button-mint-first">
                      <Plus className="h-4 w-4" />
                      {t('nfa.createFirstNfa')}
                    </Button>
                  </Link>
                </div>
              </Card>
            ) : (
              <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
                {sortedListings.map(({ listing, agent }) => (
                  <NfaCard
                    key={agent.id}
                    listing={listing}
                    agent={agent}
                    onBuy={() => buyMutation.mutate({ 
                      nfaId: agent.id, 
                      tokenId: agent.tokenId, 
                      priceWei: listing.priceWei 
                    })}
                    isBuying={buyingId === agent.id || isWaitingTx}
                    isOwner={agent.ownerAddress.toLowerCase() === address?.toLowerCase()}
                    platformFee={platformFeePercent}
                  />
                ))}
              </div>
            )}
          </main>

          {listings.length > 0 && (
            <aside className="hidden xl:block w-80 flex-shrink-0">
              <Card className="sticky top-4">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">{t('nfa.recentActivity')}</h3>
                  </div>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3 pr-4">
                      {listings.slice(0, 8).map(({ listing, agent }) => (
                        <ActivityItem
                          key={agent.id}
                          agent={agent}
                          price={listing.priceDisplay}
                          type="listing"
                          time={new Date(listing.listedAt).toLocaleDateString()}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </aside>
          )}
        </div>
          </TabsContent>

          <TabsContent value="leaderboard">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  {t('nfa.topPerformingAgents')}
                </CardTitle>
                <CardDescription>
                  {t('nfa.rankedByInteractions')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leaderboard.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('nfa.noAgentsRanked')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaderboard.map((entry, index) => (
                      <div
                        key={entry.agent.id}
                        className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                        data-testid={`leaderboard-entry-${index}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? "bg-amber-500 text-white" :
                          index === 1 ? "bg-gray-400 text-white" :
                          index === 2 ? "bg-amber-700 text-white" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{entry.agent.name}</p>
                          <p className="text-xs text-muted-foreground">{entry.agent.modelType}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{entry.stats?.totalInteractions || 0}</p>
                          <p className="text-xs text-muted-foreground">{t('nfa.interactions')}</p>
                        </div>
                        {entry.stats?.rating && entry.stats.rating > 0 && (
                          <div className="flex items-center gap-1 text-amber-500">
                            <Star className="h-4 w-4 fill-current" />
                            <span className="font-medium">{entry.stats.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.length === 0 ? (
                <Card className="col-span-full p-12 text-center">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">{t('nfa.noCategoriesYet')}</h3>
                  <p className="text-muted-foreground">
                    {t('nfa.categoriesAppear')}
                  </p>
                </Card>
              ) : (
                categories.map(cat => (
                  <Card
                    key={cat.category}
                    className="hover-elevate cursor-pointer"
                    onClick={() => {
                      setCategoryFilter(cat.category);
                    }}
                    data-testid={`category-${cat.category}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Brain className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold capitalize">{cat.category}</p>
                            <p className="text-sm text-muted-foreground">
                              {cat.count} agent{cat.count !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">{cat.count}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
