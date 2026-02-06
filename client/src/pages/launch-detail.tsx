import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  ArrowLeft, 
  ExternalLink, 
  TrendingUp, 
  TrendingDown,
  Users,
  Loader2,
  AlertCircle,
  Egg,
  Copy,
  Check,
  BarChart3
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PriceChart } from "@/components/price-chart";
import { formatEther, parseEther } from "viem";
import { useAccount, useSwitchChain, useChainId } from "wagmi";
import { useBnbPrice, formatUsd, bnbToUsd, GRADUATION_USD_TARGET } from "@/hooks/use-bnb-price";

const DEPLOYED_CHAIN_ID = 56; // BSC Mainnet
import { 
  useBondingCurveMarketAddress,
  useGetMarketState,
  useQuoteBuy,
  useQuoteSell,
  useBuyTokens,
  useSellTokens,
  useTokenBalance,
  useApproveToken,
  useTokenAllowance,
  useCanMigrate,
  useMigrateToken,
  useMigrationDeployed,
  useCooldownSeconds,
  useLastTradeTime,
  useSimulateSell,
  parseContractError,
} from "@/contracts/hooks";
import type { LaunchToken, LaunchTrade, LaunchComment } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send } from "lucide-react";

interface TokenDetailResponse {
  token: LaunchToken;
  trades: LaunchTrade[];
}

interface CommentsResponse {
  comments: LaunchComment[];
}

export default function LaunchDetail() {
  const [, params] = useRoute("/launch/:address");
  const tokenAddress = params?.address as `0x${string}` | undefined;
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitchingNetwork } = useSwitchChain();
  const marketAddress = useBondingCurveMarketAddress();
  
  const [tradeTab, setTradeTab] = useState<"buy" | "sell">("buy");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [useMaxSell, setUseMaxSell] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastTradeInfo, setLastTradeInfo] = useState<{ isBuy: boolean; nativeAmount: string; tokenAmount: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<"buy" | "sell" | null>(null);
  const [newComment, setNewComment] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  
  // Check if on deployed network
  const isOnDeployedNetwork = chainId === DEPLOYED_CHAIN_ID;
  
  const { data, isLoading, error, refetch } = useQuery<TokenDetailResponse>({
    queryKey: ["/api/launch/tokens", tokenAddress],
    queryFn: async () => {
      const res = await fetch(`/api/launch/tokens/${tokenAddress}`);
      if (!res.ok) throw new Error("Failed to fetch token");
      return res.json();
    },
    enabled: !!tokenAddress,
  });

  const { data: commentsData, refetch: refetchComments } = useQuery<CommentsResponse>({
    queryKey: ["/api/launch/tokens", tokenAddress, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/launch/tokens/${tokenAddress}/comments`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
    enabled: !!tokenAddress,
  });

  const handlePostComment = async () => {
    if (!newComment.trim() || isPostingComment) return;
    
    setIsPostingComment(true);
    try {
      await apiRequest("POST", `/api/launch/tokens/${tokenAddress}/comments`, { 
        content: newComment.trim() 
      });
      setNewComment("");
      refetchComments();
      toast({ title: "Comment posted!" });
    } catch (err) {
      toast({ 
        title: "Failed to post comment", 
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive" 
      });
    } finally {
      setIsPostingComment(false);
    }
  };

  const { data: marketState, refetch: refetchMarket } = useGetMarketState(tokenAddress);
  const { data: tokenBalance, refetch: refetchBalance } = useTokenBalance(tokenAddress, userAddress);
  const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(tokenAddress, userAddress, marketAddress);
  const { data: priceData } = useBnbPrice();
  
  const { data: canMigrate } = useCanMigrate(tokenAddress);
  const { migrate, isPending: isMigrating, isSuccess: migrateSuccess, error: migrateError } = useMigrateToken();
  const migrationDeployed = useMigrationDeployed();
  
  // Market initialization for tokens that weren't properly initialized
  // Market initialization is now automatic with dev buy - no longer needed
  
  // Cooldown checking
  const { data: cooldownSeconds } = useCooldownSeconds();
  const { data: lastTradeTimeData, refetch: refetchLastTrade } = useLastTradeTime(tokenAddress, userAddress);
  
  // Get the token's native reserve from market state (not overall contract balance)
  
  // Cooldown timer state
  const [cooldownTick, setCooldownTick] = useState(0);
  
  // Calculate if cooldown is active
  const now = Math.floor(Date.now() / 1000);
  const lastTrade = lastTradeTimeData ? Number(lastTradeTimeData) : 0;
  const cooldown = cooldownSeconds ? Number(cooldownSeconds) : 10;
  const cooldownEndsAt = lastTrade + cooldown;
  const isCooldownActive = lastTrade > 0 && now < cooldownEndsAt;
  const cooldownRemaining = isCooldownActive ? cooldownEndsAt - now : 0;
  
  // Auto-update cooldown timer
  useEffect(() => {
    if (isCooldownActive && cooldownRemaining > 0) {
      const timer = setTimeout(() => {
        setCooldownTick(t => t + 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isCooldownActive, cooldownRemaining, cooldownTick]);
  
  // Check if market is initialized - marketState returns an object with named fields
  const marketStateData = marketState as { initialized?: boolean; nativeReserve?: bigint } | undefined;
  const isMarketInitialized = marketStateData?.initialized === true;
  const tokenNativeReserve = marketStateData?.nativeReserve ?? BigInt(0);
  
  // Safely parse amounts - parseEther can crash on invalid input
  let buyAmountWei = BigInt(0);
  let sellAmountWei = BigInt(0);
  try {
    if (buyAmount && buyAmount.trim() !== '') {
      buyAmountWei = parseEther(buyAmount);
    }
  } catch {
    buyAmountWei = BigInt(0);
  }
  // Use raw tokenBalance when max is selected to avoid formatEther/parseEther conversion issues
  try {
    if (useMaxSell && tokenBalance && typeof tokenBalance === 'bigint') {
      sellAmountWei = tokenBalance;
    } else if (sellAmount && sellAmount.trim() !== '') {
      // Validate input before parsing - must be a valid number format
      const trimmedAmount = sellAmount.trim();
      // Check for valid numeric format (allows decimals and scientific notation)
      if (/^-?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(trimmedAmount)) {
        sellAmountWei = parseEther(trimmedAmount);
      }
    }
  } catch {
    sellAmountWei = BigInt(0);
  }
  
  const { data: buyQuote } = useQuoteBuy(tokenAddress, buyAmountWei > BigInt(0) ? buyAmountWei : undefined);
  const { data: sellQuote } = useQuoteSell(tokenAddress, sellAmountWei > BigInt(0) ? sellAmountWei : undefined);

  const { buy, isPending: isBuying, isSuccess: buySuccess, error: buyError, hash: buyHash, reset: resetBuy } = useBuyTokens();
  const { sell, isPending: isSelling, isSuccess: sellSuccess, error: sellError, hash: sellHash, reset: resetSell } = useSellTokens();
  const { approve, isPending: isApproving, isSuccess: approveSuccess } = useApproveToken();

  const needsApproval = tradeTab === "sell" && sellAmountWei > BigInt(0) && allowance !== undefined && typeof allowance === 'bigint' && sellAmountWei > allowance;

  // Safe type guard for quote tuples
  const isValidQuoteTuple = (quote: unknown): quote is readonly [bigint, bigint] => {
    return Array.isArray(quote) && quote.length >= 2 && typeof quote[0] === 'bigint' && typeof quote[1] === 'bigint';
  };

  // Preflight liquidity check - compare sell quote against token's native reserve
  const sellQuoteValue = isValidQuoteTuple(sellQuote) ? sellQuote : undefined;
  const expectedNativeOut = sellQuoteValue ? sellQuoteValue[0] : BigInt(0);
  // Use the token's specific native reserve, not overall contract balance
  const hasInsufficientLiquidity = sellAmountWei > BigInt(0) && expectedNativeOut > BigInt(0) && tokenNativeReserve > BigInt(0) && expectedNativeOut > tokenNativeReserve;

  // Simulate sell transaction to catch errors before executing
  // Only simulate when we have a valid quote and the user doesn't need approval
  const minOutForSimulation = sellQuoteValue ? (sellQuoteValue[0] * BigInt(95)) / BigInt(100) : undefined;
  const shouldSimulateSell = !needsApproval && sellAmountWei > BigInt(0) && minOutForSimulation !== undefined && minOutForSimulation > BigInt(0);
  const { error: sellSimulationError } = useSimulateSell(
    tokenAddress,
    shouldSimulateSell ? sellAmountWei : undefined,
    shouldSimulateSell ? minOutForSimulation : undefined,
    userAddress
  );
  const simulationErrorMessage = sellSimulationError ? parseContractError(sellSimulationError) : null;

  useEffect(() => {
    const recordAndRefresh = async () => {
      if ((buySuccess || sellSuccess) && tokenAddress && userAddress && lastTradeInfo) {
        try {
          await apiRequest("POST", "/api/launch/trades", {
            tokenAddress,
            trader: userAddress,
            isBuy: lastTradeInfo.isBuy,
            nativeAmount: lastTradeInfo.nativeAmount,
            tokenAmount: lastTradeInfo.tokenAmount,
            feeNative: "0",
            priceAfter: "0",
            txHash: buyHash || sellHash || null,
          });
        } catch (error) {
          console.error("Failed to record trade:", error);
        }
        
        toast({
          title: "Trade successful!",
          description: buySuccess ? "Tokens purchased successfully." : "Tokens sold successfully.",
        });
        setBuyAmount("");
        setSellAmount("");
        setUseMaxSell(false);
        setLastTradeInfo(null);
        refetch();
        refetchMarket();
        refetchBalance();
        refetchLastTrade();
        queryClient.invalidateQueries({ queryKey: ["/api/launch/tokens", tokenAddress] });
      }
    };
    
    recordAndRefresh();
  }, [buySuccess, sellSuccess, buyHash, sellHash, tokenAddress, userAddress, lastTradeInfo, toast, refetch, refetchMarket, refetchBalance, refetchLastTrade]);

  useEffect(() => {
    if (buyError || sellError) {
      const error = buyError || sellError;
      toast({
        title: "Trade failed",
        description: parseContractError(error),
        variant: "destructive",
      });
    }
  }, [buyError, sellError, toast]);

  useEffect(() => {
    if (approveSuccess) {
      toast({
        title: "Approval successful",
        description: "You can now sell tokens.",
      });
      // Refetch allowance to update the UI
      refetchAllowance();
    }
  }, [approveSuccess, toast, refetchAllowance]);

  useEffect(() => {
    if (migrateSuccess && tokenAddress) {
      toast({
        title: "Migration successful!",
        description: "Token has been migrated to PancakeSwap.",
      });
      refetch();
      refetchMarket();
      refetchBalance();
      queryClient.invalidateQueries({ queryKey: ["/api/launch/tokens", tokenAddress] });
    }
  }, [migrateSuccess, tokenAddress, toast, refetch, refetchMarket, refetchBalance]);

  useEffect(() => {
    if (migrateError) {
      toast({
        title: "Migration failed",
        description: migrateError.message || "Failed to migrate token.",
        variant: "destructive",
      });
    }
  }, [migrateError, toast]);

  // Timeout for stuck transactions - mobile wallets sometimes don't respond
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;
    
    if ((isBuying || isSelling) && !buyHash && !sellHash) {
      timeoutId = setTimeout(() => {
        if (isBuying) {
          resetBuy();
          toast({
            title: "Transaction timed out",
            description: "Wallet didn't respond. Please try again.",
            variant: "destructive",
          });
        }
        if (isSelling) {
          resetSell();
          toast({
            title: "Transaction timed out", 
            description: "Wallet didn't respond. Please try again.",
            variant: "destructive",
          });
        }
      }, 20000); // 20 second timeout
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isBuying, isSelling, buyHash, sellHash, resetBuy, resetSell, toast]);


  const executeBuy = () => {
    if (!tokenAddress || buyAmountWei <= BigInt(0)) return;
    
    if (!marketAddress) {
      toast({
        title: "Trading unavailable",
        description: "Please connect to BNB Chain to trade tokens.",
        variant: "destructive",
      });
      return;
    }
    
    const quoteValue = buyQuote as readonly [bigint, bigint] | undefined;
    const minOut = quoteValue ? (quoteValue[0] * BigInt(95)) / BigInt(100) : BigInt(0);
    const estimatedTokens = quoteValue ? quoteValue[0].toString() : "0";
    
    setLastTradeInfo({
      isBuy: true,
      nativeAmount: buyAmountWei.toString(),
      tokenAmount: estimatedTokens,
    });
    
    toast({
      title: "Confirm in Wallet",
      description: "Please check your wallet app to approve the transaction.",
    });
    
    buy(tokenAddress, minOut, buyAmountWei);
  };

  const executeSell = () => {
    if (!tokenAddress || sellAmountWei <= BigInt(0)) return;
    
    if (!marketAddress) {
      toast({
        title: "Trading unavailable",
        description: "Please connect to BNB Chain to trade tokens.",
        variant: "destructive",
      });
      return;
    }
    
    if (needsApproval) {
      toast({
        title: "Approval Required",
        description: "Please approve the token spending in your wallet.",
      });
      approve(tokenAddress, marketAddress, sellAmountWei);
      return;
    }
    
    const minOut = sellQuoteValue ? (sellQuoteValue[0] * BigInt(95)) / BigInt(100) : BigInt(0);
    const estimatedNative = sellQuoteValue ? sellQuoteValue[0].toString() : "0";
    
    setLastTradeInfo({
      isBuy: false,
      nativeAmount: estimatedNative,
      tokenAmount: sellAmountWei.toString(),
    });
    
    toast({
      title: "Confirm in Wallet",
      description: "Please check your wallet app to approve the transaction.",
    });
    
    sell(tokenAddress, sellAmountWei, minOut);
  };

  // Effect to execute pending action after network switch
  useEffect(() => {
    if (pendingAction && isOnDeployedNetwork) {
      const action = pendingAction;
      setPendingAction(null);
      if (action === "buy") {
        executeBuy();
      } else {
        executeSell();
      }
    }
  }, [pendingAction, isOnDeployedNetwork]);

  const handleBuy = async () => {
    if (!tokenAddress || buyAmountWei <= BigInt(0)) return;
    
    // Auto-switch network if needed
    if (!isOnDeployedNetwork) {
      try {
        setPendingAction("buy");
        await switchChain({ chainId: DEPLOYED_CHAIN_ID });
        return; // Effect will handle execution after switch
      } catch (e) {
        console.error("Network switch failed:", e);
        setPendingAction(null);
        return;
      }
    }
    
    executeBuy();
  };

  const handleSell = async () => {
    if (!tokenAddress || sellAmountWei <= BigInt(0) || !marketAddress) return;
    
    // Auto-switch network if needed
    if (!isOnDeployedNetwork) {
      try {
        setPendingAction("sell");
        await switchChain({ chainId: DEPLOYED_CHAIN_ID });
        return; // Effect will handle execution after switch
      } catch (e) {
        console.error("Network switch failed:", e);
        setPendingAction(null);
        return;
      }
    }
    
    executeSell();
  };

  const copyAddress = () => {
    if (tokenAddress) {
      navigator.clipboard.writeText(tokenAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-32 mb-6" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-12 w-12 rounded-full mb-4" />
                <Skeleton className="h-6 w-1/2 mb-2" />
                <Skeleton className="h-4 w-3/4 mb-4" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-1/2 mb-4" />
              <Skeleton className="h-10 w-full mb-2" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <Link href="/launch">
          <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Back to Launchpad
          </Button>
        </Link>
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 p-6 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Token not found or failed to load.</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { token, trades } = data;
  const bnbPrice = priceData?.price || 600;
  
  const totalRaised = BigInt(token.totalRaisedNative || "0");
  const totalRaisedBnb = Number(formatEther(totalRaised));
  const totalRaisedUsd = bnbToUsd(totalRaisedBnb, bnbPrice);
  const progress = (totalRaisedUsd / GRADUATION_USD_TARGET) * 100;

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <Link href="/launch">
        <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Launchpad
        </Button>
      </Link>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-4 mb-4">
                {token.imageUrl ? (
                  <img 
                    src={token.imageUrl} 
                    alt={token.name} 
                    className="w-16 h-16 rounded-full object-cover border"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold text-xl">
                      {token.symbol.slice(0, 2)}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-2xl font-bold">{token.name}</h1>
                    {token.migrated ? (
                      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                        Migrated to DEX
                      </Badge>
                    ) : token.graduated ? (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                        Graduated
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground font-mono">${token.symbol}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1 truncate">
                  {tokenAddress}
                </code>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={copyAddress}
                  data-testid="button-copy-address"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              {token.description && (
                <p className="text-muted-foreground mb-4">{token.description}</p>
              )}

              {!token.graduated && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-muted-foreground mb-2">
                    <span>Progress to graduation</span>
                    <span>{formatUsd(totalRaisedUsd)} / $50k</span>
                  </div>
                  <Progress value={Math.min(progress, 100)} className="h-3" />
                </div>
              )}

              {token.migrated && token.pairAddress && (
                <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <h3 className="font-semibold text-blue-600 mb-2">DEX Migration Complete</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">LP Pair:</span>
                      <code className="font-mono text-xs">{token.pairAddress.slice(0, 10)}...{token.pairAddress.slice(-8)}</code>
                    </div>
                    {token.lpLockAddress && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">LP Lock:</span>
                        <code className="font-mono text-xs">{token.lpLockAddress.slice(0, 10)}...{token.lpLockAddress.slice(-8)}</code>
                      </div>
                    )}
                    {token.lpAmount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">LP Amount:</span>
                        <span>{formatEther(BigInt(token.lpAmount))} LP</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    This token is now tradable on PancakeSwap. Internal market trading is disabled.
                  </p>
                </div>
              )}

              {token.graduated && !token.migrated && (
                migrationDeployed && canMigrate ? (
                  <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-amber-600">Ready for DEX Migration</h3>
                        <p className="text-sm text-muted-foreground">
                          Migrate liquidity to PancakeSwap to enable DEX trading.
                        </p>
                      </div>
                      <Button
                        onClick={async () => {
                          if (!tokenAddress) return;
                          migrate(tokenAddress);
                        }}
                        disabled={isMigrating}
                        className="shrink-0"
                        data-testid="button-migrate"
                      >
                        {isMigrating ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Migrating...
                          </>
                        ) : (
                          <>
                            <Egg className="h-4 w-4 mr-2" />
                            Migrate to DEX
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 p-4 bg-muted/50 border rounded-lg">
                    <h3 className="font-semibold text-muted-foreground">Migration Not Available</h3>
                    <p className="text-sm text-muted-foreground">
                      {!migrationDeployed 
                        ? "DEX migration is not available on this network." 
                        : "Token is not yet eligible for migration. Requirements may not be met."}
                    </p>
                  </div>
                )
              )}

              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{token.tradeCount} trades</span>
                </div>
                <div>
                  Created {formatDistanceToNow(new Date(token.createdAt), { addSuffix: true })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Price Chart
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PriceChart 
                trades={trades} 
                symbol={token.symbol}
                totalRaisedNative={token.totalRaisedNative}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trade History</CardTitle>
            </CardHeader>
            <CardContent>
              {trades.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No trades yet</p>
              ) : (
                <div className="space-y-2">
                  {trades.map((trade) => (
                    <div 
                      key={trade.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                    >
                      <div className="flex items-center gap-3">
                        {trade.isBuy ? (
                          <TrendingUp className="h-5 w-5 text-green-500" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium">
                            {trade.isBuy ? "Buy" : "Sell"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(trade.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm">
                          {formatEther(BigInt(trade.tokenAmount))} {token.symbol}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {formatEther(BigInt(trade.nativeAmount))} BNB
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Discussion
                {commentsData?.comments?.length ? (
                  <Badge variant="secondary">{commentsData.comments.length}</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isAuthenticated && (
                <div className="flex gap-2 mb-4">
                  <Textarea
                    placeholder="Share your thoughts about this token..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[60px] resize-none"
                    maxLength={500}
                    data-testid="input-comment"
                  />
                  <Button
                    onClick={handlePostComment}
                    disabled={isPostingComment || !newComment.trim()}
                    size="icon"
                    data-testid="button-post-comment"
                  >
                    {isPostingComment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
              
              {!commentsData?.comments?.length ? (
                <p className="text-muted-foreground text-center py-6">
                  {isAuthenticated ? "Be the first to comment!" : "No comments yet"}
                </p>
              ) : (
                <div className="space-y-3">
                  {commentsData.comments.map((comment) => (
                    <div 
                      key={comment.id}
                      className="p-3 bg-muted/50 rounded-md"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {comment.walletAddress.slice(0, 6)}...{comment.walletAddress.slice(-4)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Egg className="h-5 w-5" />
                Trade
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isAuthenticated || !userAddress ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">Connect wallet to trade</p>
                </div>
              ) : token.migrated ? (
                <div className="text-center py-4">
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-muted-foreground">
                      This token has been migrated to PancakeSwap.
                    </p>
                    {token.pairAddress && (
                      <Button variant="outline" asChild>
                        <a 
                          href={`https://pancakeswap.finance/swap?outputCurrency=${tokenAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="link-trade-pancakeswap"
                        >
                          Trade on PancakeSwap
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ) : token.graduated ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">
                    This token has graduated. Migration to DEX pending.
                  </p>
                </div>
              ) : !isMarketInitialized ? (
                <div className="text-center py-6 space-y-4">
                  <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
                  <div>
                    <h3 className="font-semibold text-lg">Market Pending</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      This token's market is being initialized. Please wait a moment and refresh.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      refetchMarket();
                      toast({ title: "Refreshing market state..." });
                    }}
                    className="gap-2"
                    data-testid="button-refresh-market"
                  >
                    <Loader2 className="h-4 w-4" />
                    Refresh Status
                  </Button>
                </div>
              ) : (
                <>
                  <Tabs value={tradeTab} onValueChange={(v) => setTradeTab(v as "buy" | "sell")}>
                    <TabsList className="w-full mb-4">
                      <TabsTrigger value="buy" className="flex-1" data-testid="tab-buy">
                        Buy
                      </TabsTrigger>
                      <TabsTrigger value="sell" className="flex-1" data-testid="tab-sell">
                        Sell
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="buy" className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">BNB Amount</label>
                        <Input
                          type="number"
                          placeholder="0.0"
                          value={buyAmount}
                          onChange={(e) => setBuyAmount(e.target.value)}
                          step="0.01"
                          min="0"
                          data-testid="input-buy-amount"
                        />
                      </div>
                      
                      {buyQuote && buyAmountWei > BigInt(0) && (
                        <div className="bg-muted/50 p-3 rounded-md">
                          <p className="text-sm text-muted-foreground">You will receive:</p>
                          <p className="font-mono font-medium">
                            ~{formatEther((buyQuote as readonly [bigint, bigint])[0])} {token.symbol}
                          </p>
                        </div>
                      )}

                      {isCooldownActive && (
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span>Please wait {cooldownRemaining}s before trading again</span>
                        </div>
                      )}

                      <Button
                        onClick={handleBuy}
                        disabled={isBuying || isSwitchingNetwork || !buyAmount || parseFloat(buyAmount) <= 0 || isCooldownActive}
                        className="w-full gap-2"
                        data-testid="button-buy"
                      >
                        {isBuying || isSwitchingNetwork ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {isSwitchingNetwork ? "Switching Network..." : "Buying..."}
                          </>
                        ) : isCooldownActive ? (
                          `Wait ${cooldownRemaining}s`
                        ) : (
                          "Buy Tokens"
                        )}
                      </Button>
                    </TabsContent>

                    <TabsContent value="sell" className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm font-medium">Token Amount</label>
                          {tokenBalance !== undefined && typeof tokenBalance === 'bigint' && tokenBalance > BigInt(0) && (
                            <button
                              className="text-xs text-primary hover:underline"
                              onClick={() => {
                                setUseMaxSell(true);
                                setSellAmount(Number(formatEther(tokenBalance)).toFixed(4));
                              }}
                            >
                              Max: {Number(formatEther(tokenBalance)).toFixed(2)}
                            </button>
                          )}
                        </div>
                        <Input
                          type="number"
                          placeholder="0.0"
                          value={sellAmount}
                          onChange={(e) => {
                            setUseMaxSell(false);
                            setSellAmount(e.target.value);
                          }}
                          step="1"
                          min="0"
                          data-testid="input-sell-amount"
                        />
                      </div>
                      
                      {sellQuoteValue && sellAmountWei > BigInt(0) && (
                        <div className="bg-muted/50 p-3 rounded-md space-y-1">
                          <p className="text-sm text-muted-foreground">You will receive:</p>
                          <p className="font-mono font-medium">
                            ~{formatEther(sellQuoteValue[0])} BNB
                          </p>
                        </div>
                      )}

                      {isCooldownActive && (
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span>Please wait {cooldownRemaining}s before trading again</span>
                        </div>
                      )}

                      {hasInsufficientLiquidity && !isCooldownActive && !simulationErrorMessage && (
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span>Insufficient liquidity. Try selling a smaller amount.</span>
                        </div>
                      )}

                      {simulationErrorMessage && !isCooldownActive && !needsApproval && (
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span>{simulationErrorMessage}</span>
                        </div>
                      )}

                      <Button
                        onClick={handleSell}
                        disabled={isSelling || isApproving || isSwitchingNetwork || !sellAmount || parseFloat(sellAmount) <= 0 || isCooldownActive || hasInsufficientLiquidity || (simulationErrorMessage !== null && !needsApproval)}
                        className="w-full gap-2"
                        data-testid="button-sell"
                      >
                        {isSelling || isApproving || isSwitchingNetwork ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {isSwitchingNetwork ? "Switching Network..." : isApproving ? "Approving..." : "Selling..."}
                          </>
                        ) : isCooldownActive ? (
                          `Wait ${cooldownRemaining}s`
                        ) : (simulationErrorMessage && !needsApproval) ? (
                          "Sell Blocked"
                        ) : hasInsufficientLiquidity ? (
                          "Insufficient Liquidity"
                        ) : needsApproval ? (
                          "Approve & Sell"
                        ) : (
                          "Sell Tokens"
                        )}
                      </Button>
                    </TabsContent>
                  </Tabs>

                  <p className="text-xs text-muted-foreground text-center mt-4">
                    1% fee on all trades. 5% slippage tolerance.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {tokenBalance !== undefined && typeof tokenBalance === 'bigint' && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Your Balance</p>
                <p className="font-mono font-bold text-lg">
                  {Number(formatEther(tokenBalance)).toLocaleString()} {token.symbol}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
