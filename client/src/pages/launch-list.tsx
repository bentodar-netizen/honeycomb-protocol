import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Egg, Plus, TrendingUp, Users, AlertCircle, Crown, 
  Search, Flame, Clock, GraduationCap, ArrowUpRight, ArrowDownRight,
  Sparkles, Activity, Construction
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { formatEther } from "viem";
import type { LaunchToken, LaunchActivity } from "@shared/schema";
import { useBnbPrice, formatUsd, bnbToUsd, GRADUATION_USD_TARGET } from "@/hooks/use-bnb-price";

// COMING SOON MODE - Set to false to enable the launchpad
const COMING_SOON_MODE = true;

interface TokensResponse {
  tokens: LaunchToken[];
}

interface ActivityResponse {
  activity: LaunchActivity[];
}

export default function LaunchList() {
  // Show Coming Soon page
  if (COMING_SOON_MODE) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Card className="max-w-lg mx-auto text-center p-8">
          <CardContent className="space-y-6 pt-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center">
              <Construction className="h-10 w-10 text-amber-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">The Hatchery</h1>
              <Badge className="bg-amber-500 text-white mb-4">Coming Soon</Badge>
            </div>
            <p className="text-muted-foreground text-lg">
              We're preparing something amazing! The AI-native token launchpad is being upgraded with new features.
            </p>
            <div className="pt-4 space-y-2">
              <p className="text-sm text-muted-foreground">Expected features:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Badge variant="outline">Bonding Curves</Badge>
                <Badge variant="outline">Auto-Graduation</Badge>
                <Badge variant="outline">PancakeSwap Migration</Badge>
                <Badge variant="outline">AI Agent Launches</Badge>
              </div>
            </div>
            <div className="pt-4">
              <Link href="/">
                <Button variant="outline">Back to Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  const [filter, setFilter] = useState<"hot" | "new" | "graduating" | "graduated">("hot");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { isAuthenticated, agent } = useAuth();
  const { t, getDateLocale } = useI18n();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, error } = useQuery<TokensResponse>({
    queryKey: ["/api/launch/tokens", filter],
    queryFn: async () => {
      let url = "/api/launch/tokens?limit=50";
      if (filter === "graduating" || filter === "hot" || filter === "new") {
        url += "&graduated=false";
      }
      if (filter === "graduated") url += "&graduated=true";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch tokens");
      return res.json();
    },
  });

  const { data: trendingData } = useQuery<TokensResponse>({
    queryKey: ["/api/launch/trending"],
    queryFn: async () => {
      const res = await fetch("/api/launch/trending?limit=1");
      if (!res.ok) throw new Error("Failed to fetch trending");
      return res.json();
    },
  });

  const { data: activityData } = useQuery<ActivityResponse>({
    queryKey: ["/api/launch/activity"],
    queryFn: async () => {
      const res = await fetch("/api/launch/activity?limit=10");
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: searchData } = useQuery<TokensResponse>({
    queryKey: ["/api/launch/search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim()) return { tokens: [] };
      const res = await fetch(`/api/launch/search?q=${encodeURIComponent(debouncedSearch)}&limit=10`);
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled: debouncedSearch.length > 0,
  });

  const nestLeader = trendingData?.tokens?.[0];
  const displayTokens = debouncedSearch ? searchData?.tokens : data?.tokens;

  const sortedTokens = displayTokens ? [...displayTokens].sort((a, b) => {
    if (filter === "hot") {
      return (b.tradeCount || 0) - (a.tradeCount || 0);
    }
    if (filter === "new") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (filter === "graduating") {
      const aRaised = BigInt(a.totalRaisedNative || "0");
      const bRaised = BigInt(b.totalRaisedNative || "0");
      return Number(bRaised - aRaised);
    }
    return 0;
  }) : [];

  return (
    <div className="py-6 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Egg className="h-8 w-8 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold">{t('launchpad.title')}</h1>
            </div>
            {isAuthenticated && agent ? (
              <Link href="/launch/new">
                <Button className="gap-2" data-testid="button-create-token">
                  <Plus className="h-4 w-4" />
                  {t('launchpad.createToken')}
                </Button>
              </Link>
            ) : (
              <Link href="/register">
                <Button variant="outline" className="gap-2" data-testid="button-register-to-launch">
                  <Plus className="h-4 w-4" />
                  {t('register.registerAsBee')}
                </Button>
              </Link>
            )}
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tokens by name or symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-tokens"
            />
          </div>

          {nestLeader && !debouncedSearch && (
            <Card className="mb-6 border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-transparent">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-lg">Nest Leader</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Link href={`/launch/${nestLeader.tokenAddress}`}>
                  <div className="flex items-center gap-4 hover-elevate rounded-lg p-2 -m-2 cursor-pointer">
                    {nestLeader.imageUrl ? (
                      <img 
                        src={nestLeader.imageUrl} 
                        alt={nestLeader.name} 
                        className="w-16 h-16 rounded-full object-cover border-2 border-amber-500"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center border-2 border-amber-500">
                        <span className="text-amber-500 font-bold text-xl">
                          {nestLeader.symbol.slice(0, 2)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-lg">{nestLeader.name}</h3>
                        <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                          ${nestLeader.symbol}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {formatEther(BigInt(nestLeader.totalRaisedNative || "0"))} BNB raised
                        </span>
                        <span className="flex items-center gap-1 text-green-500">
                          <TrendingUp className="h-3 w-3" />
                          {nestLeader.tradeCount} trades
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}

          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="hot" className="gap-1" data-testid="tab-hot">
                <Flame className="h-3 w-3" />
                <span className="hidden sm:inline">Hot</span>
              </TabsTrigger>
              <TabsTrigger value="new" className="gap-1" data-testid="tab-new">
                <Sparkles className="h-3 w-3" />
                <span className="hidden sm:inline">New</span>
              </TabsTrigger>
              <TabsTrigger value="graduating" className="gap-1" data-testid="tab-graduating">
                <TrendingUp className="h-3 w-3" />
                <span className="hidden sm:inline">Graduating</span>
              </TabsTrigger>
              <TabsTrigger value="graduated" className="gap-1" data-testid="tab-graduated">
                <GraduationCap className="h-3 w-3" />
                <span className="hidden sm:inline">Graduated</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-5 w-1/2 mb-2" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {error && (
            <Card className="border-destructive">
              <CardContent className="flex items-center gap-3 p-6 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span>{t('launchpad.loadError')}</span>
              </CardContent>
            </Card>
          )}

          {sortedTokens && sortedTokens.length === 0 && !isLoading && (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
                <Egg className="h-16 w-16 text-muted-foreground/50" />
                <div>
                  <h3 className="text-lg font-semibold">
                    {debouncedSearch ? "No tokens found" : t('launchpad.noTokens')}
                  </h3>
                  <p className="text-muted-foreground">
                    {debouncedSearch ? "Try a different search term" : t('launchpad.beFirst')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {sortedTokens && sortedTokens.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {sortedTokens.map((token) => (
                <TokenCard key={token.tokenAddress} token={token} />
              ))}
            </div>
          )}
        </div>

        <div className="lg:w-80 shrink-0">
          <Card className="sticky top-4">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Live Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              {!activityData?.activity?.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent activity
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {activityData.activity.map((item) => (
                    <ActivityItem key={item.id} activity={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TokenCard({ token }: { token: LaunchToken }) {
  const { t, getDateLocale } = useI18n();
  const { data: priceData } = useBnbPrice();
  const bnbPrice = priceData?.price || 600;
  
  const totalRaised = BigInt(token.totalRaisedNative || "0");
  const totalRaisedBnb = Number(formatEther(totalRaised));
  const totalRaisedUsd = bnbToUsd(totalRaisedBnb, bnbPrice);
  const progress = (totalRaisedUsd / GRADUATION_USD_TARGET) * 100;

  return (
    <Link href={`/launch/${token.tokenAddress}`}>
      <Card 
        className="hover-elevate transition-all duration-200 cursor-pointer h-full" 
        data-testid={`card-token-${token.tokenAddress}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3 mb-3">
            {token.imageUrl ? (
              <img 
                src={token.imageUrl} 
                alt={token.name} 
                className="w-12 h-12 rounded-full object-cover border"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold">
                  {token.symbol.slice(0, 2)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold truncate">{token.name}</h3>
                {token.graduated && (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 shrink-0">
                    <GraduationCap className="h-3 w-3 mr-1" />
                    {t('launchpad.graduated')}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-mono">${token.symbol}</p>
            </div>
          </div>

          {token.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {token.description}
            </p>
          )}

          {!token.graduated && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{t('launchpad.progressToGraduation')}</span>
                <span>{formatUsd(totalRaisedUsd)} / $50k</span>
              </div>
              <Progress value={Math.min(progress, 100)} className="h-2" />
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{token.tradeCount} trades</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {formatDistanceToNow(new Date(token.createdAt), { addSuffix: true, ...getDateLocale() })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ActivityItem({ activity }: { activity: LaunchActivity }) {
  const { getDateLocale } = useI18n();
  const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const getIcon = () => {
    switch (activity.type) {
      case 'launch': return <Egg className="h-3.5 w-3.5 text-blue-500" />;
      case 'buy': return <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />;
      case 'sell': return <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />;
      case 'graduate': return <GraduationCap className="h-3.5 w-3.5 text-amber-500" />;
      case 'migrate': return <Sparkles className="h-3.5 w-3.5 text-purple-500" />;
      default: return <Activity className="h-3.5 w-3.5" />;
    }
  };

  const getMessage = () => {
    const actor = activity.actorName || shortAddress(activity.actorAddress);
    const amount = activity.nativeAmount ? 
      `${Number(formatEther(BigInt(activity.nativeAmount))).toFixed(4)} BNB` : '';
    
    switch (activity.type) {
      case 'launch': return <span><strong>{actor}</strong> launched <strong>${activity.tokenSymbol}</strong></span>;
      case 'buy': return <span><strong>{actor}</strong> bought <strong>{amount}</strong> of <strong>${activity.tokenSymbol}</strong></span>;
      case 'sell': return <span><strong>{actor}</strong> sold <strong>{amount}</strong> of <strong>${activity.tokenSymbol}</strong></span>;
      case 'graduate': return <span><strong>${activity.tokenSymbol}</strong> graduated!</span>;
      case 'migrate': return <span><strong>${activity.tokenSymbol}</strong> migrated to DEX</span>;
      default: return <span>Activity on <strong>${activity.tokenSymbol}</strong></span>;
    }
  };

  return (
    <Link href={`/launch/${activity.tokenAddress}`}>
      <div className="flex items-start gap-2 p-2 rounded-md hover-elevate cursor-pointer text-sm">
        <div className="mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="line-clamp-2">{getMessage()}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, ...getDateLocale() })}
          </div>
        </div>
        {activity.tokenImage && (
          <img 
            src={activity.tokenImage} 
            alt={activity.tokenSymbol || ''} 
            className="w-8 h-8 rounded-full object-cover"
          />
        )}
      </div>
    </Link>
  );
}
