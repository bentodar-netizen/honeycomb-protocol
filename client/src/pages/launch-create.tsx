import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Egg, ArrowLeft, AlertCircle, Upload, X, ImageIcon, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { useCreateToken, useTokenFactoryAddress, useBuyTokens, useInitializeMarket } from "@/contracts/hooks";
import { useAccount, useWaitForTransactionReceipt, useSwitchChain, useChainId, usePublicClient } from "wagmi";
import { decodeEventLog, parseEther } from "viem";
import { HoneycombTokenFactoryABI } from "@/contracts/abis";
import { generateRandomSalt, VanityMineProgress, mineVanityAddressFast, BEE_SUFFIX } from "@/lib/vanity-miner";
import { CONTRACT_ADDRESSES } from "@/contracts/addresses";

// BSC Mainnet is now the primary deployed network
const DEPLOYED_CHAIN_ID = 56;

const createTokenSchema = z.object({
  name: z.string().min(1, "Name is required").max(32, "Name too long"),
  symbol: z.string().min(1, "Symbol is required").max(10, "Symbol too long").toUpperCase(),
  description: z.string().max(500, "Description too long").optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  twitter: z.string().optional().or(z.literal("")),
  telegram: z.string().optional().or(z.literal("")),
  devBuyAmount: z.string().min(1, "Initial buy is required").refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0.1;
    },
    { message: "Minimum initial buy is 0.1 BNB" }
  ),
});

type CreateTokenForm = z.infer<typeof createTokenSchema>;

export default function LaunchCreate() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, agent } = useAuth();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const factoryAddress = useTokenFactoryAddress();
  const publicClient = usePublicClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<"form" | "mining" | "creating" | "recording">("form");
  const [metadataCID, setMetadataCID] = useState<string>("");
  const [formData, setFormData] = useState<CreateTokenForm | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState<CreateTokenForm | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadedLogoUrl, setUploadedLogoUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [miningProgress, setMiningProgress] = useState<VanityMineProgress | null>(null);
  const [minedSalt, setMinedSalt] = useState<`0x${string}` | null>(null);
  const [createdTokenAddress, setCreatedTokenAddress] = useState<`0x${string}` | null>(null);
  const [devBuyAmountWei, setDevBuyAmountWei] = useState<bigint | null>(null);
  const [isDevBuying, setIsDevBuying] = useState(false);
  const recordingAttemptedRef = useRef(false);
  
  // Check if on deployed network
  const isOnDeployedNetwork = chainId === DEPLOYED_CHAIN_ID;
  const contractsDeployed = factoryAddress && factoryAddress !== "0x0000000000000000000000000000000000000000";
  
  const { createToken, isPending: isCreating, isSuccess: txSuccess, hash, error: txError } = useCreateToken();
  const { isLoading: isConfirming, isSuccess: isConfirmed, data: txReceipt } = useWaitForTransactionReceipt({ hash });
  
  // Market initialization hook (separate transaction after token creation)
  const { 
    initializeMarket, 
    isPending: isInitPending, 
    isConfirming: isInitConfirming, 
    isSuccess: isInitSuccess, 
    error: initError 
  } = useInitializeMarket();
  
  // Dev buy hook (separate transaction after market initialization)
  const { buy: buyTokens, isPending: isBuyPending, isConfirming: isBuyConfirming, isSuccess: isBuySuccess, error: buyError } = useBuyTokens();
  
  // Track whether we're in the initialization phase
  const [isInitializing, setIsInitializing] = useState(false);

  const form = useForm<CreateTokenForm>({
    resolver: zodResolver(createTokenSchema),
    defaultValues: {
      name: "",
      symbol: "",
      description: "",
      website: "",
      twitter: "",
      telegram: "",
      devBuyAmount: "0.1",
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (PNG, JPG, GIF, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setUploadedLogoUrl(data.url);
      toast({ title: "Logo uploaded!" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
      setLogoFile(null);
      setLogoPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setUploadedLogoUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const storeMutation = useMutation({
    mutationFn: async (data: CreateTokenForm) => {
      const res = await apiRequest<{ metadataCID: string }>("POST", "/api/launch/storage/token-metadata", {
        name: data.name,
        symbol: data.symbol.toUpperCase(),
        description: data.description || "",
        imageUrl: uploadedLogoUrl || "",
        links: {
          website: data.website || undefined,
          twitter: data.twitter || undefined,
          telegram: data.telegram || undefined,
        },
        creatorBeeId: agent?.id,
      });
      return res;
    },
  });

  const recordMutation = useMutation({
    mutationFn: async (data: { tokenAddress: string; formData: CreateTokenForm; cid: string }) => {
      const res = await apiRequest("POST", "/api/launch/tokens", {
        tokenAddress: data.tokenAddress,
        name: data.formData.name,
        symbol: data.formData.symbol.toUpperCase(),
        metadataCID: data.cid,
        description: data.formData.description || "",
        imageUrl: uploadedLogoUrl || "",
        creatorBeeId: agent?.id,
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/launch/tokens"] });
    },
  });

  // Helper function to continue after network switch
  const handleSubmitAfterSwitch = async (data: CreateTokenForm) => {
    try {
      setFormData(data);
      setStep("creating");
      
      // Store dev buy amount if provided
      if (data.devBuyAmount && parseFloat(data.devBuyAmount) > 0) {
        try {
          const amountWei = parseEther(data.devBuyAmount);
          setDevBuyAmountWei(amountWei);
          console.log("Dev buy amount set:", data.devBuyAmount, "BNB, wei:", amountWei.toString());
        } catch (e) {
          console.error("Invalid dev buy amount:", e);
          setDevBuyAmountWei(null);
        }
      } else {
        setDevBuyAmountWei(null);
      }
      
      // Store metadata first
      const metaResult = await storeMutation.mutateAsync(data);
      const cid = metaResult.metadataCID;
      setMetadataCID(cid);
      
      // Mine for vanity address ending with "bee"
      setStep("mining");
      setMiningProgress({ attempts: 0, currentAddress: "" });
      
      const beeId = BigInt(0);
      
      toast({
        title: "Mining bee address",
        description: "Finding a token address ending with 'bee'...",
      });
      
      // Use fast off-chain mining for "bee" suffix
      const vanityResult = factoryAddress ? await mineVanityAddressFast(
        factoryAddress,
        data.name,
        data.symbol.toUpperCase(),
        cid,
        beeId,
        (progress) => setMiningProgress(progress),
        BEE_SUFFIX,
        500000
      ) : null;
      
      let finalSalt: `0x${string}`;
      if (vanityResult) {
        finalSalt = vanityResult.salt;
        console.log(`Found bee address in ${vanityResult.attempts} attempts:`, vanityResult.address);
        toast({
          title: "Bee address found!",
          description: `Token will deploy to ${vanityResult.address.slice(0, 10)}...${vanityResult.address.slice(-8)}`,
        });
      } else {
        // Fall back to random salt if vanity mining times out
        finalSalt = generateRandomSalt();
        toast({
          title: "Using standard address",
          description: "Vanity mining timed out, using standard deployment.",
        });
      }
      
      setMinedSalt(finalSalt);
      setMiningProgress(null);
      setStep("creating");
      
      toast({
        title: "Creating token",
        description: "Please confirm the transaction in your wallet.",
      });
      
      createToken(data.name, data.symbol.toUpperCase(), cid, beeId, finalSalt);
    } catch (error: any) {
      console.error("Error creating token:", error);
      console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      setStep("form");
      setFormData(null);
      setMiningProgress(null);
      setMinedSalt(null);
      setDevBuyAmountWei(null);
      
      // Extract meaningful error message
      let errorMsg = "Failed to create token. Please try again.";
      if (error?.shortMessage) {
        errorMsg = error.shortMessage;
      } else if (error?.message) {
        errorMsg = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  // Check for pending launch on mount (persisted across network switch)
  useEffect(() => {
    const pending = localStorage.getItem("pendingTokenLaunch");
    if (pending && isOnDeployedNetwork) {
      try {
        const data = JSON.parse(pending) as CreateTokenForm;
        localStorage.removeItem("pendingTokenLaunch");
        console.log("Resuming token launch after network switch...");
        handleSubmitAfterSwitch(data);
      } catch (e) {
        localStorage.removeItem("pendingTokenLaunch");
      }
    }
  }, [isOnDeployedNetwork]);

  // Also check when chainId changes (for cases where page doesn't reload)
  useEffect(() => {
    if (pendingSubmit && isOnDeployedNetwork) {
      console.log("Network switch detected, continuing with token creation...");
      const data = pendingSubmit;
      setPendingSubmit(null);
      localStorage.removeItem("pendingTokenLaunch");
      handleSubmitAfterSwitch(data);
    }
  }, [pendingSubmit, isOnDeployedNetwork, chainId]);

  const onSubmit = async (data: CreateTokenForm) => {
    console.log("onSubmit called with data:", data);
    console.log("address:", address, "chainId:", chainId, "isOnDeployedNetwork:", isOnDeployedNetwork);
    
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to launch a token.",
        variant: "destructive",
      });
      return;
    }

    // Auto-switch network if needed (like four.meme)
    if (!isOnDeployedNetwork) {
      console.log("Need to switch network. Target chain:", DEPLOYED_CHAIN_ID);
      
      // Store form data in both state and localStorage (for page reload scenarios)
      setPendingSubmit(data);
      localStorage.setItem("pendingTokenLaunch", JSON.stringify(data));
      
      try {
        // Use wagmi's switchChain which handles different wallet providers better
        console.log("Using wagmi switchChain...");
        await switchChain({ chainId: DEPLOYED_CHAIN_ID });
        console.log("Switch call completed!");
        // The useEffect will handle submission after chain updates
        return;
      } catch (e: any) {
        console.error("Network switch failed:", e);
        console.error("Error details:", JSON.stringify(e, null, 2));
        
        // Check if it's a user rejection
        const isUserRejection = e?.code === 4001 || 
          e?.message?.includes('rejected') || 
          e?.message?.includes('denied');
        
        if (!isUserRejection) {
          // Show helpful message with manual instructions
          toast({
            title: "Please switch to BNB Smart Chain",
            description: "Open your wallet and switch to BNB Smart Chain (Chain ID: 56), then try again.",
            variant: "destructive",
          });
        }
        
        setPendingSubmit(null);
        localStorage.removeItem("pendingTokenLaunch");
        return;
      }
    }

    // Already on correct network, proceed immediately
    await handleSubmitAfterSwitch(data);
  };


  useEffect(() => {
    if (txError) {
      console.error("Transaction error:", txError);
      console.error("Transaction error details:", JSON.stringify(txError, Object.getOwnPropertyNames(txError)));
      setStep("form");
      
      // Extract meaningful error message
      let errorMsg = "Failed to create token on-chain.";
      const err = txError as any;
      if (err?.shortMessage) {
        errorMsg = err.shortMessage;
      } else if (err?.message) {
        errorMsg = err.message;
      } else if (err?.cause?.shortMessage) {
        errorMsg = err.cause.shortMessage;
      }
      
      toast({
        title: "Transaction failed",
        description: errorMsg,
        variant: "destructive",
      });
    }
  }, [txError, toast]);

  useEffect(() => {
    const recordToken = async () => {
      if (isConfirmed && hash && txReceipt && formData && metadataCID && !isDevBuying && !recordingAttemptedRef.current) {
        recordingAttemptedRef.current = true;
        try {
          setStep("recording");
          
          let tokenAddress: string | null = null;
          for (const log of txReceipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: HoneycombTokenFactoryABI,
                data: log.data,
                topics: log.topics,
              });
              if (decoded.eventName === "TokenCreated") {
                const args = decoded.args as { token: string; creator: string; name: string; symbol: string };
                tokenAddress = args.token;
                break;
              }
            } catch {
            }
          }
          
          if (tokenAddress) {
            setCreatedTokenAddress(tokenAddress as `0x${string}`);
            
            await recordMutation.mutateAsync({
              tokenAddress,
              formData,
              cid: metadataCID,
            });
            
            // Step 2: Initialize market before dev buy
            if (devBuyAmountWei && devBuyAmountWei > BigInt(0)) {
              setIsInitializing(true);
              toast({
                title: "Token created!",
                description: "Initializing market for trading...",
              });
              console.log("Initializing market for token:", tokenAddress);
              initializeMarket(tokenAddress as `0x${string}`);
            } else {
              toast({
                title: "Token launched!",
                description: "Your token has been created. Initialize market to start trading.",
              });
              navigate(`/launch/${tokenAddress}`);
            }
          } else {
            toast({
              title: "Token launched!",
              description: "Your token has been created on the blockchain.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/launch/tokens"] });
            navigate("/launch");
          }
        } catch (error) {
          console.error("Error recording token:", error);
          // Still try to initialize market even if recording failed
          if (createdTokenAddress && devBuyAmountWei && devBuyAmountWei > BigInt(0)) {
            toast({
              title: "Token created!",
              description: "Recording failed but initializing market...",
            });
            setIsInitializing(true);
            console.log("Initializing market for token (after record error):", createdTokenAddress);
            initializeMarket(createdTokenAddress);
          } else {
            toast({
              title: "Token launched!",
              description: "Your token was created but recording failed. Check launchpad.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/launch/tokens"] });
            navigate("/launch");
          }
        }
      }
    };
    
    recordToken();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed, hash, txReceipt, formData, metadataCID, devBuyAmountWei, isDevBuying]);
  
  // Handle market initialization success - then execute dev buy
  useEffect(() => {
    if (isInitSuccess && isInitializing && createdTokenAddress && devBuyAmountWei && devBuyAmountWei > BigInt(0)) {
      console.log("Market initialized! Executing dev buy for:", createdTokenAddress);
      setIsInitializing(false);
      setIsDevBuying(true);
      toast({
        title: "Market initialized!",
        description: "Now executing your initial buy...",
      });
      buyTokens(createdTokenAddress, BigInt(0), devBuyAmountWei);
    }
  }, [isInitSuccess, isInitializing, createdTokenAddress, devBuyAmountWei, toast, buyTokens]);
  
  // Handle market initialization error
  useEffect(() => {
    if (initError && isInitializing && createdTokenAddress) {
      console.error("Market initialization failed:", initError);
      setIsInitializing(false);
      toast({
        title: "Initialization failed",
        description: "Market couldn't be initialized. Token is created but not tradable yet.",
        variant: "destructive",
      });
      navigate(`/launch/${createdTokenAddress}`);
    }
  }, [initError, isInitializing, createdTokenAddress, navigate, toast]);
  
  // Handle dev buy completion
  useEffect(() => {
    if (isBuySuccess && isDevBuying && createdTokenAddress) {
      toast({
        title: "Token launched!",
        description: "You've successfully purchased tokens. Trading is now live!",
      });
      setIsDevBuying(false);
      navigate(`/launch/${createdTokenAddress}`);
    }
  }, [isBuySuccess, isDevBuying, createdTokenAddress, navigate, toast]);
  
  // Handle dev buy error
  useEffect(() => {
    if (buyError && isDevBuying && createdTokenAddress) {
      console.error("Dev buy failed:", buyError);
      toast({
        title: "Market initialized!",
        description: "Dev buy failed, but token is tradable.",
        variant: "destructive",
      });
      setIsDevBuying(false);
      navigate(`/launch/${createdTokenAddress}`);
    }
  }, [buyError, isDevBuying, createdTokenAddress, navigate, toast]);

  if (!isAuthenticated || !agent) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <AlertCircle className="h-16 w-16 text-muted-foreground/50" />
            <div>
              <h3 className="text-lg font-semibold">Authentication Required</h3>
              <p className="text-muted-foreground mb-4">
                You need to be registered as a Bee to launch a token.
              </p>
            </div>
            <Link href="/register">
              <Button>Register as Bee</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPending = step !== "form" || storeMutation.isPending || isCreating || isConfirming || isUploading || isSwitching || isInitializing || isInitPending || isInitConfirming || isDevBuying || isBuyPending || isBuyConfirming;

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <Link href="/launch">
        <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Launchpad
        </Button>
      </Link>

      {/* Network Warning Banner */}
      {!isOnDeployedNetwork && (
        <Card className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Wrong Network Detected
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Please switch to BNB Smart Chain (Chain ID: 56) in your wallet to launch tokens.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900"
                onClick={async () => {
                  try {
                    await switchChain({ chainId: DEPLOYED_CHAIN_ID });
                  } catch (e) {
                    console.error("Switch failed:", e);
                    toast({
                      title: "Please switch manually",
                      description: "Open your wallet and switch to BSC Testnet.",
                    });
                  }
                }}
                disabled={isSwitching}
                data-testid="button-switch-network"
              >
                {isSwitching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Switch Network"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Egg className="h-6 w-6 text-primary" />
            Launch New Token
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Honeycomb Token"
                          {...field}
                          disabled={isPending}
                          data-testid="input-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Symbol</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="HONEY"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          disabled={isPending}
                          data-testid="input-symbol"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell the world about your token..."
                        rows={3}
                        {...field}
                        disabled={isPending}
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormDescription>Optional, max 500 characters</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel>Token Logo</FormLabel>
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isPending}
                    data-testid="input-logo-file"
                  />
                  
                  {logoPreview ? (
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20 rounded-lg">
                        <AvatarImage src={logoPreview} alt="Token logo" className="object-cover" />
                        <AvatarFallback className="rounded-lg">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-muted-foreground">{logoFile?.name}</p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isPending}
                            data-testid="button-change-logo"
                          >
                            Change
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={removeLogo}
                            disabled={isPending}
                            data-testid="button-remove-logo"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {isUploading && (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isPending}
                      className="w-full h-24 border-dashed"
                      data-testid="button-upload-logo"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Click to upload logo</span>
                      </div>
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Optional, max 5MB. Recommended: square image, 256x256px or larger.
                </p>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-4 text-muted-foreground">Social Links (Optional)</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://"
                            {...field}
                            disabled={isPending}
                            data-testid="input-website"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="twitter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twitter</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="@handle"
                            {...field}
                            disabled={isPending}
                            data-testid="input-twitter"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telegram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telegram</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="t.me/group"
                            {...field}
                            disabled={isPending}
                            data-testid="input-telegram"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="devBuyAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Dev Buy (Required)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.1"
                        placeholder="0.1"
                        {...field}
                        disabled={isPending}
                        data-testid="input-dev-buy"
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum 0.1 BNB required to launch and initialize the market. This initializes trading on the bonding curve.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-muted/50 p-4 rounded-md text-sm">
                <p className="font-medium mb-2">Token Launch Details:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span className="text-foreground font-medium">Contract address ending in "bee"</span>
                  </li>
                  <li>Total Supply: 1,000,000,000 tokens</li>
                  <li>Trading starts immediately via bonding curve</li>
                  <li>1% fee on all trades</li>
                  <li>Graduates to DEX at $50k market cap</li>
                </ul>
              </div>

              {step === "mining" && (
                <div className="bg-primary/10 border border-primary/30 p-4 rounded-md text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    <span className="font-medium">Mining Bee Address</span>
                  </div>
                  <p className="text-muted-foreground mb-2">
                    Finding a token address ending with "bee"...
                  </p>
                  {miningProgress && (
                    <div className="space-y-1">
                      <Progress value={Math.min((miningProgress.attempts / 100000) * 100, 95)} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {miningProgress.attempts.toLocaleString()} attempts
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={isPending}
                data-testid="button-submit"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isUploading ? "Uploading..." :
                     step === "mining" ? "Mining Bee Address..." :
                     step === "creating" ? "Creating Token..." : 
                     isConfirming ? "Confirming Token..." :
                     isInitializing || isInitPending ? "Initializing Market..." :
                     isInitConfirming ? "Confirming Market..." :
                     isDevBuying || isBuyPending ? "Executing Dev Buy..." :
                     isBuyConfirming ? "Confirming Dev Buy..." : "Processing..."}
                  </>
                ) : (
                  <>
                    <Egg className="h-4 w-4" />
                    Hatch Token
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
