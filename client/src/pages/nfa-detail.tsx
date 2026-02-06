import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bot, Brain, Zap, ArrowLeft, Star, ShoppingCart, Activity, 
  Database, Fingerprint, TrendingUp, MessageSquare, Shield, History,
  DollarSign, Pause, Play, XCircle, Wallet, BookOpen, BarChart3,
  Send, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { ERC8004ReputationScore } from "@/components/erc8004-reputation-badge";
import { ERC8004FeedbackForm } from "@/components/erc8004-feedback-form";
import { ERC8004TrustBadge } from "@/components/erc8004-trust-badge";
import { ERC8004IdentityPassport, ERC8004IdentityBanner } from "@/components/erc8004-identity-passport";
import { ERC8004ActivityHistory } from "@/components/erc8004-activity-history";
import { ERC8004AgentVerification } from "@/components/erc8004-agent-verification";

interface NfaAgent {
  id: string;
  tokenId: number;
  ownerAddress: string;
  name: string;
  description: string | null;
  modelType: string;
  agentType: string;
  status: string;
  proofOfPrompt: string;
  memoryRoot: string | null;
  trainingVersion: number;
  interactionCount: number;
  category: string | null;
  systemPrompt: string | null;
  createdAt: string;
  lastActiveAt: string;
  persona: string | null;
  experience: string | null;
  voiceHash: string | null;
  animationUri: string | null;
  vaultUri: string | null;
  vaultHash: string | null;
  balance: string;
  logicAddress: string | null;
  lastActionTimestamp: string;
  learningEnabled: boolean;
  learningModuleId: string | null;
  learningTreeRoot: string | null;
  learningVersion: number;
  lastLearningUpdate: string | null;
  templateId: string | null;
}

interface NfaStats {
  totalInteractions: number;
  totalRevenue: string;
  rating: number;
  ratingCount: number;
}

interface NfaVerification {
  status: string;
  verifierAddress?: string;
  badge?: string;
  verifiedAt?: string;
}

interface NfaListing {
  id: string;
  priceWei: string;
  priceDisplay: string;
  active: boolean;
}

interface NfaMemory {
  id: string;
  memoryKey: string;
  memoryValue: string;
  version: number;
  updatedAt: string;
}

interface NfaInteraction {
  id: string;
  callerAddress: string;
  interactionType: string;
  createdAt: string;
}

interface LearningMetrics {
  totalInteractions: number;
  learningEvents: number;
  learningVelocity: string;
  confidenceScore: string;
  treeDepth: number;
  totalNodes: number;
}

interface LearningModule {
  id: string;
  name: string;
  moduleType: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
}

export default function NfaDetail() {
  const [, params] = useRoute("/nfa/:id");
  const nfaId = params?.id;
  const { address, isConnected } = useAccount();
  const { isAuthenticated, authenticate } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [listPrice, setListPrice] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [messageInput, setMessageInput] = useState("");
  const [agentResponse, setAgentResponse] = useState<string | null>(null);

  const { data: agentData, isLoading } = useQuery<{
    agent: NfaAgent;
    stats: NfaStats;
    verification: NfaVerification;
    listing: NfaListing | null;
    learningMetrics: LearningMetrics | null;
    learningModule: LearningModule | null;
    template: Template | null;
  }>({
    queryKey: ["/api/nfa/agents", nfaId],
    enabled: !!nfaId,
  });

  const { data: memoryData } = useQuery<{ memory: NfaMemory[] }>({
    queryKey: ["/api/nfa/agents", nfaId, "memory"],
    enabled: !!nfaId,
  });

  const { data: interactionsData } = useQuery<{ interactions: NfaInteraction[] }>({
    queryKey: ["/api/nfa/agents", nfaId, "interactions"],
    enabled: !!nfaId,
  });

  const ensureAuthenticated = async () => {
    if (!isAuthenticated) {
      try {
        await authenticate();
        return true;
      } catch {
        toast({
          title: "Authentication Required",
          description: "Please sign the message to authenticate.",
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const pauseMutation = useMutation({
    mutationFn: async () => {
      if (!await ensureAuthenticated()) throw new Error("Not authenticated");
      return apiRequest("POST", `/api/nfa/agents/${nfaId}/pause`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfa/agents", nfaId] });
      toast({ title: "Agent Paused", description: "Your agent has been paused." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Pause", description: error.message, variant: "destructive" });
    },
  });

  const unpauseMutation = useMutation({
    mutationFn: async () => {
      if (!await ensureAuthenticated()) throw new Error("Not authenticated");
      return apiRequest("POST", `/api/nfa/agents/${nfaId}/unpause`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfa/agents", nfaId] });
      toast({ title: "Agent Resumed", description: "Your agent is now active." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Unpause", description: error.message, variant: "destructive" });
    },
  });

  const terminateMutation = useMutation({
    mutationFn: async () => {
      if (!await ensureAuthenticated()) throw new Error("Not authenticated");
      return apiRequest("POST", `/api/nfa/agents/${nfaId}/terminate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfa/agents", nfaId] });
      toast({ title: "Agent Terminated", description: "Your agent has been permanently terminated." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Terminate", description: error.message, variant: "destructive" });
    },
  });

  const fundMutation = useMutation({
    mutationFn: async (amount: string) => {
      if (!await ensureAuthenticated()) throw new Error("Not authenticated");
      return apiRequest("POST", `/api/nfa/agents/${nfaId}/fund`, { amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfa/agents", nfaId] });
      toast({ title: "Agent Funded", description: "Funds have been added to your agent." });
      setFundAmount("");
    },
    onError: (error: Error) => {
      toast({ title: "Funding Failed", description: error.message, variant: "destructive" });
    },
  });

  const listMutation = useMutation({
    mutationFn: async (price: string) => {
      if (!await ensureAuthenticated()) throw new Error("Not authenticated");
      const priceWei = (parseFloat(price) * 1e18).toString();
      return apiRequest("POST", "/api/nfa/marketplace/list", {
        nfaId,
        priceWei,
        priceDisplay: `${price} BNB`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfa/agents", nfaId] });
      toast({ title: "Agent Listed", description: "Your NFA is now for sale." });
      setListPrice("");
    },
    onError: (error: Error) => {
      toast({ title: "Listing Failed", description: error.message, variant: "destructive" });
    },
  });

  const delistMutation = useMutation({
    mutationFn: async () => {
      if (!await ensureAuthenticated()) throw new Error("Not authenticated");
      return apiRequest("POST", `/api/nfa/marketplace/delist/${nfaId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfa/agents", nfaId] });
      toast({ title: "Listing Removed", description: "Your NFA is no longer for sale." });
    },
  });

  const rateMutation = useMutation({
    mutationFn: async (rating: number) => {
      if (!await ensureAuthenticated()) throw new Error("Not authenticated");
      return apiRequest("POST", `/api/nfa/agents/${nfaId}/rate`, {
        raterAddress: address,
        rating,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfa/agents", nfaId] });
      toast({ title: "Rating Submitted", description: "Thank you for your feedback!" });
    },
    onError: (error: Error) => {
      toast({ title: "Rating Failed", description: error.message, variant: "destructive" });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!await ensureAuthenticated()) throw new Error("Not authenticated");
      const response = await apiRequest("POST", `/api/nfa/agents/${nfaId}/execute`, {
        actionType: "CHAT",
        actionData: { message },
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfa/agents", nfaId, "interactions"] });
      setAgentResponse(data.action?.actionData ? JSON.parse(data.action.actionData)?.message || "Action executed successfully!" : "Action logged!");
      setMessageInput("");
      toast({ title: "Message Sent", description: "Your action has been logged." });
    },
    onError: (error: Error) => {
      toast({ title: "Execute Failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Card className="animate-pulse">
          <CardContent className="p-8">
            <div className="h-8 bg-muted rounded w-1/3 mb-4" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!agentData?.agent) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Card className="text-center p-8">
          <Bot className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Agent Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This Non-Fungible Agent doesn't exist or has been removed.
          </p>
          <Link href="/nfa">
            <Button>Back to Marketplace</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { agent, stats, verification, listing, learningMetrics, learningModule, template } = agentData;
  const memory = memoryData?.memory || [];
  const interactions = interactionsData?.interactions || [];
  const isOwner = isConnected && address?.toLowerCase() === agent.ownerAddress.toLowerCase();

  const getStatusBadge = () => {
    switch (agent.status) {
      case "ACTIVE":
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case "PAUSED":
        return <Badge variant="secondary" className="bg-amber-500 text-white">Paused</Badge>;
      case "TERMINATED":
        return <Badge variant="destructive">Terminated</Badge>;
      default:
        return <Badge variant="outline">{agent.status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <Link href="/nfa">
          <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Back to Marketplace
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-xl bg-primary/10">
                    <Bot className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl" data-testid="text-agent-name">
                      {agent.name}
                    </CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="outline">Token #{agent.tokenId}</Badge>
                      <Badge variant={agent.agentType === "LEARNING" ? "default" : "secondary"}>
                        {agent.agentType === "LEARNING" ? (
                          <><Brain className="h-3 w-3 mr-1" /> Learning</>
                        ) : (
                          <><Zap className="h-3 w-3 mr-1" /> Static</>
                        )}
                      </Badge>
                      {getStatusBadge()}
                      {verification.status === "VERIFIED" && (
                        <Badge variant="outline" className="text-green-500 border-green-500">
                          <Shield className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
                {isOwner && (
                  <Badge variant="outline" className="text-amber-500 border-amber-500">
                    Owner
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {agent.description || "No description provided."}
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Bot className="h-4 w-4" />
                    Model
                  </div>
                  <p className="font-medium mt-1">{agent.modelType}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Activity className="h-4 w-4" />
                    Interactions
                  </div>
                  <p className="font-medium mt-1">{stats.totalInteractions}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Wallet className="h-4 w-4" />
                    Balance
                  </div>
                  <p className="font-medium mt-1">{parseFloat(agent.balance || "0").toFixed(4)} BNB</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Star className="h-4 w-4" />
                    Rating
                  </div>
                  <p className="font-medium mt-1">
                    {stats.ratingCount > 0 ? `${stats.rating.toFixed(1)} (${stats.ratingCount})` : "No ratings"}
                  </p>
                </div>
              </div>

              {agent.experience && (
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <p className="text-xs text-muted-foreground mb-1">Experience</p>
                  <p className="text-sm">{agent.experience}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Interact with Agent */}
          <Card className="bg-gradient-to-br from-amber-500/5 to-amber-600/10 border-amber-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-amber-500" />
                Interact with Agent
              </CardTitle>
              <CardDescription>
                Send a message to interact with this AI agent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {agent.status !== "ACTIVE" ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Pause className="h-8 w-8 mx-auto mb-2" />
                  <p>This agent is {agent.status.toLowerCase()} and cannot receive messages</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type your message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && messageInput.trim()) {
                          executeMutation.mutate(messageInput);
                        }
                      }}
                      disabled={executeMutation.isPending}
                      data-testid="input-agent-message"
                    />
                    <Button
                      onClick={() => messageInput.trim() && executeMutation.mutate(messageInput)}
                      disabled={!messageInput.trim() || executeMutation.isPending}
                      data-testid="button-send-message"
                    >
                      {executeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {agentResponse && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground mb-1">Agent Response</p>
                      <p className="text-sm">{agentResponse}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Messages are logged on-chain. {!isOwner && "You need execute permission to interact."}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="memory">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="memory" className="gap-2" data-testid="tab-memory">
                <Database className="h-4 w-4" />
                Memory
              </TabsTrigger>
              <TabsTrigger value="learning" className="gap-2" data-testid="tab-learning">
                <BarChart3 className="h-4 w-4" />
                Learning
              </TabsTrigger>
              <TabsTrigger value="proof" className="gap-2" data-testid="tab-proof">
                <Fingerprint className="h-4 w-4" />
                Proof
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-2" data-testid="tab-activity">
                <Activity className="h-4 w-4" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="reputation" className="gap-2" data-testid="tab-reputation">
                <Star className="h-4 w-4" />
                Reputation
              </TabsTrigger>
            </TabsList>

            <TabsContent value="memory" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Memory Vault</CardTitle>
                  <CardDescription>On-chain memory storage</CardDescription>
                </CardHeader>
                <CardContent>
                  {memory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-8 w-8 mx-auto mb-2" />
                      <p>No memory entries yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {memory.map(m => (
                        <div key={m.id} className="p-3 rounded-lg border">
                          <div className="flex justify-between items-start">
                            <code className="text-sm font-medium">{m.memoryKey}</code>
                            <Badge variant="outline" className="text-xs">v{m.version}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 break-all">
                            {m.memoryValue}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {agent.memoryRoot && (
                    <div className="mt-4 p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Memory Root</p>
                      <code className="text-xs font-mono break-all">{agent.memoryRoot}</code>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="learning" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Learning Metrics (BAP-578)
                  </CardTitle>
                  <CardDescription>
                    {agent.learningEnabled ? "Learning agent with Merkle Tree verification" : "Static agent (not learning-enabled)"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {agent.learningEnabled && learningMetrics ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Learning Events</p>
                          <p className="text-xl font-bold">{learningMetrics.learningEvents}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Confidence Score</p>
                          <p className="text-xl font-bold">{parseFloat(learningMetrics.confidenceScore).toFixed(2)}%</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Tree Depth</p>
                          <p className="text-xl font-bold">{learningMetrics.treeDepth}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Total Nodes</p>
                          <p className="text-xl font-bold">{learningMetrics.totalNodes}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Learning Version</p>
                          <p className="text-xl font-bold">v{agent.learningVersion}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Velocity</p>
                          <p className="text-xl font-bold">{parseFloat(learningMetrics.learningVelocity).toFixed(2)}</p>
                        </div>
                      </div>
                      {learningModule && (
                        <div className="p-3 rounded-lg border">
                          <div className="flex items-center gap-2 mb-1">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Learning Module</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>{learningModule.name}</span>
                            <Badge variant="outline" className="text-xs">{learningModule.moduleType}</Badge>
                          </div>
                        </div>
                      )}
                      {agent.learningTreeRoot && (
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Learning Tree Root (Merkle)</p>
                          <code className="text-xs font-mono break-all">{agent.learningTreeRoot}</code>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Zap className="h-8 w-8 mx-auto mb-2" />
                      <p>Static agent - no learning capabilities</p>
                      <p className="text-xs mt-1">Uses JSON Light Memory instead of Merkle Tree Learning</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="proof" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Fingerprint className="h-5 w-5" />
                    Proof-of-Prompt
                  </CardTitle>
                  <CardDescription>Cryptographic verification of training</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">PoP Hash</p>
                    <code className="text-sm font-mono break-all">{agent.proofOfPrompt}</code>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <Shield className="h-5 w-5 text-green-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-green-500">Verified On-Chain</p>
                      <p className="text-muted-foreground">
                        Immutably stored to verify agent's training configuration.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                  <CardDescription>Last {interactions.length} interactions</CardDescription>
                </CardHeader>
                <CardContent>
                  {interactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2" />
                      <p>No interactions recorded</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {interactions.slice(0, 10).map(i => (
                        <div key={i.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <span className="capitalize">{i.interactionType}</span>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">
                            {i.callerAddress.slice(0, 6)}...{i.callerAddress.slice(-4)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(i.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reputation" className="mt-4">
              <div className="space-y-6">
                <ERC8004IdentityBanner 
                  agentId={BigInt(agent.tokenId)}
                  agentName={agent.name}
                />

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Star className="h-5 w-5 text-amber-500" />
                        Reputation Score
                      </CardTitle>
                      <CardDescription>
                        Aggregated on-chain reputation from the ERC-8004 registry
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ERC8004ReputationScore 
                        agentId={BigInt(agent.tokenId)} 
                        className="mb-4"
                      />
                      <div className="flex items-center gap-2 mt-4">
                        <span className="text-sm text-muted-foreground">Trust Level:</span>
                        <ERC8004TrustBadge agentId={BigInt(agent.tokenId)} size="md" />
                      </div>
                    </CardContent>
                  </Card>

                  <ERC8004FeedbackForm 
                    agentId={BigInt(agent.tokenId)}
                    endpoint={`/nfa/${agent.tokenId}`}
                  />
                </div>

                <ERC8004ActivityHistory 
                  agentId={BigInt(agent.tokenId)}
                  maxItems={10}
                />

                <ERC8004AgentVerification />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          {listing?.active && (
            <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-600/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-green-500" />
                  For Sale
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                  <span className="text-2xl font-bold">{listing.priceDisplay}</span>
                </div>
                {!isOwner && isConnected && (
                  <Button className="w-full" data-testid="button-buy">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Buy Now
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {isOwner && agent.status !== "TERMINATED" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Lifecycle Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {agent.status === "ACTIVE" ? (
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => pauseMutation.mutate()}
                    disabled={pauseMutation.isPending}
                    data-testid="button-pause"
                  >
                    <Pause className="h-4 w-4" />
                    Pause Agent
                  </Button>
                ) : agent.status === "PAUSED" && (
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => unpauseMutation.mutate()}
                    disabled={unpauseMutation.isPending}
                    data-testid="button-unpause"
                  >
                    <Play className="h-4 w-4" />
                    Resume Agent
                  </Button>
                )}
                <Button 
                  variant="destructive" 
                  className="w-full gap-2"
                  onClick={() => {
                    if (window.confirm("Are you sure? This action is permanent and cannot be undone.")) {
                      terminateMutation.mutate();
                    }
                  }}
                  disabled={terminateMutation.isPending}
                  data-testid="button-terminate"
                >
                  <XCircle className="h-4 w-4" />
                  Terminate Agent
                </Button>
              </CardContent>
            </Card>
          )}

          {isOwner && agent.status !== "TERMINATED" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Fund Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.1"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      data-testid="input-fund-amount"
                    />
                    <Button
                      onClick={() => fundMutation.mutate(fundAmount)}
                      disabled={!fundAmount || fundMutation.isPending}
                      data-testid="button-fund"
                    >
                      <DollarSign className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Amount in BNB</p>
                </div>
              </CardContent>
            </Card>
          )}

          {isOwner && agent.status !== "TERMINATED" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Marketplace</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {listing?.active ? (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => delistMutation.mutate()}
                    disabled={delistMutation.isPending}
                    data-testid="button-delist"
                  >
                    Remove Listing
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="listPrice">List for Sale</Label>
                    <div className="flex gap-2">
                      <Input
                        id="listPrice"
                        type="number"
                        step="0.01"
                        placeholder="0.1"
                        value={listPrice}
                        onChange={(e) => setListPrice(e.target.value)}
                        data-testid="input-list-price"
                      />
                      <Button
                        onClick={() => listMutation.mutate(listPrice)}
                        disabled={!listPrice || listMutation.isPending}
                        data-testid="button-list"
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Price in BNB</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!isOwner && isConnected && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Rate Agent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setNewRating(star)}
                      className="p-1"
                      data-testid={`button-star-${star}`}
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= newRating
                            ? "text-amber-500 fill-amber-500"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <Button
                  className="w-full"
                  onClick={() => rateMutation.mutate(newRating)}
                  disabled={rateMutation.isPending}
                  data-testid="button-submit-rating"
                >
                  Submit Rating
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Owner</span>
                <code className="font-mono">
                  {agent.ownerAddress.slice(0, 6)}...{agent.ownerAddress.slice(-4)}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(agent.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Active</span>
                <span>{new Date(agent.lastActiveAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <Badge variant="outline">{agent.category || "Uncategorized"}</Badge>
              </div>
              {template && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Template</span>
                  <Badge variant="outline">{template.name}</Badge>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span>v{agent.trainingVersion}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
