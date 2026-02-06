import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { keccak256, toBytes } from "viem";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Brain, Zap, Fingerprint, Database, Sparkles, ArrowLeft, CheckCircle, Info, FileText, Shield, Cpu, BookOpen, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getToken } from "@/lib/auth";
import { Link } from "wouter";

const MODEL_TYPES = [
  { value: "gpt-4", label: "GPT-4", provider: "OpenAI" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo", provider: "OpenAI" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", provider: "OpenAI" },
  { value: "claude-3-opus", label: "Claude 3 Opus", provider: "Anthropic" },
  { value: "claude-3-sonnet", label: "Claude 3 Sonnet", provider: "Anthropic" },
  { value: "claude-3-haiku", label: "Claude 3 Haiku", provider: "Anthropic" },
  { value: "gemini-pro", label: "Gemini Pro", provider: "Google" },
  { value: "llama-3-70b", label: "Llama 3 70B", provider: "Meta" },
  { value: "mistral-large", label: "Mistral Large", provider: "Mistral" },
  { value: "custom", label: "Custom Model", provider: "Other" },
];

const CATEGORIES = [
  "Trading",
  "DeFi",
  "NFT",
  "Gaming",
  "Social",
  "Data Analysis",
  "Content Creation",
  "Customer Support",
  "Research",
  "Security",
  "Other",
];

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultPersona: string;
  defaultExperience: string;
  defaultSystemPrompt: string;
  suggestedCapabilities: string[] | null;
  iconUri: string | null;
}

interface LearningModule {
  id: string;
  name: string;
  description: string | null;
  moduleType: string;
  version: string;
}

export default function NfaMint() {
  const [, navigate] = useLocation();
  const { address, isConnected } = useAccount();
  const { isAuthenticated, authenticate } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mintMode, setMintMode] = useState<"template" | "custom">("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modelType, setModelType] = useState("gpt-4");
  const [agentType, setAgentType] = useState<"STATIC" | "LEARNING">("STATIC");
  const [category, setCategory] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [metadataUri, setMetadataUri] = useState("");
  const [persona, setPersona] = useState("");
  const [experience, setExperience] = useState("");
  const [learningModuleId, setLearningModuleId] = useState<string>("");
  const [step, setStep] = useState(1);
  const [isMinting, setIsMinting] = useState(false);

  const { data: templatesData } = useQuery<{ templates: Template[] }>({
    queryKey: ["/api/nfa/templates"],
  });

  const { data: modulesData } = useQuery<{ modules: LearningModule[] }>({
    queryKey: ["/api/nfa/learning-modules"],
  });

  const templates = templatesData?.templates || [];
  const learningModules = modulesData?.modules || [];

  const mintMutation = useMutation({
    mutationFn: async (data: {
      tokenId: number;
      ownerAddress: string;
      name: string;
      description: string;
      modelType: string;
      agentType: string;
      category: string;
      systemPrompt: string;
      metadataUri: string;
      proofOfPrompt: string;
      persona?: string;
      experience?: string;
      learningEnabled?: boolean;
      learningModuleId?: string;
      templateId?: string;
    }) => {
      const token = getToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch("/api/nfa/agents/mint", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfa/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nfa/marketplace/listings"] });
      toast({
        title: "NFA Minted Successfully!",
        description: "Your Non-Fungible Agent has been created.",
      });
      navigate("/nfa");
    },
    onError: (error: Error) => {
      toast({
        title: "Minting Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateProofOfPrompt = (prompt: string, model: string): string => {
    const data = `${prompt}:${model}:${Date.now()}`;
    return keccak256(toBytes(data));
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      setCategory(template.category);
      setSystemPrompt(template.defaultSystemPrompt);
      setPersona(template.defaultPersona);
      setExperience(template.defaultExperience);
    }
  };

  const handleMint = async () => {
    if (!isConnected || !address) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to mint an NFA.",
        variant: "destructive",
      });
      return;
    }

    if (!isAuthenticated) {
      try {
        toast({
          title: "Sign to Authenticate",
          description: "Please sign the message in your wallet to authenticate.",
        });
        await authenticate();
      } catch {
        toast({
          title: "Authentication Failed",
          description: "Please sign the message to authenticate and mint.",
          variant: "destructive",
        });
        return;
      }
    }

    if (!name.trim()) {
      toast({
        title: "Name Required",
        description: "Please provide a name for your agent.",
        variant: "destructive",
      });
      return;
    }

    setIsMinting(true);

    try {
      const proofOfPrompt = generateProofOfPrompt(systemPrompt, modelType);
      // Use a smaller random number that fits in integer range (max 2147483647)
      const tokenId = Math.floor(Math.random() * 2147483647);

      await mintMutation.mutateAsync({
        tokenId,
        ownerAddress: address,
        name: name.trim(),
        description: description.trim(),
        modelType,
        agentType,
        category,
        systemPrompt,
        metadataUri,
        proofOfPrompt,
        persona: persona || undefined,
        experience: experience || undefined,
        learningEnabled: agentType === "LEARNING",
        learningModuleId: agentType === "LEARNING" && learningModuleId ? learningModuleId : undefined,
        templateId: selectedTemplateId || undefined,
      });
    } catch (error) {
      console.error("Mint error:", error);
    } finally {
      setIsMinting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <Card className="text-center p-8">
          <Bot className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connect Wallet</h2>
          <p className="text-muted-foreground mb-4">
            Please connect your wallet to mint a Non-Fungible Agent.
          </p>
        </Card>
      </div>
    );
  }

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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl" data-testid="text-page-title">Mint NFA (BAP-578)</CardTitle>
              <CardDescription>
                Create a new Non-Fungible Agent with full BAP-578 compliance
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`flex items-center gap-2 ${s < 4 ? "flex-1" : ""}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s ? <CheckCircle className="h-4 w-4" /> : s}
                </div>
                {s < 4 && (
                  <div className={`flex-1 h-1 ${step > s ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Choose Creation Method
              </h3>

              <Tabs value={mintMode} onValueChange={(v) => setMintMode(v as "template" | "custom")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="template" className="gap-2" data-testid="tab-template">
                    <FileText className="h-4 w-4" />
                    From Template
                  </TabsTrigger>
                  <TabsTrigger value="custom" className="gap-2" data-testid="tab-custom">
                    <Cpu className="h-4 w-4" />
                    Custom Agent
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="template" className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Start with a pre-configured agent template for common use cases
                  </p>
                  <div className="grid gap-3">
                    {templates.map((template) => (
                      <Card
                        key={template.id}
                        className={`cursor-pointer transition-all ${
                          selectedTemplateId === template.id 
                            ? "ring-2 ring-primary" 
                            : "hover-elevate"
                        }`}
                        onClick={() => applyTemplate(template.id)}
                        data-testid={`template-${template.name.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              {template.category === "Guardian" ? (
                                <Shield className="h-5 w-5 text-primary" />
                              ) : template.category === "Analyst" ? (
                                <Database className="h-5 w-5 text-primary" />
                              ) : template.category === "Trader" ? (
                                <Zap className="h-5 w-5 text-primary" />
                              ) : (
                                <Bot className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{template.name}</h4>
                                <Badge variant="outline" className="text-xs">{template.category}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{template.description}</p>
                            </div>
                            {selectedTemplateId === template.id && (
                              <CheckCircle className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="custom" className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Build a completely custom agent from scratch
                  </p>
                  <div className="p-4 rounded-lg border bg-muted/30 text-center">
                    <Cpu className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Configure all settings manually in the next steps
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <Label htmlFor="name">Agent Name *</Label>
                <Input
                  id="name"
                  placeholder="My AI Agent"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={64}
                  data-testid="input-name"
                />
                <p className="text-xs text-muted-foreground">{name.length}/64 characters</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Agent Details
              </h3>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what your agent does..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  data-testid="input-description"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modelType">AI Model</Label>
                  <Select value={modelType} onValueChange={setModelType}>
                    <SelectTrigger data-testid="select-model">
                      <SelectValue placeholder="Select AI model" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_TYPES.map(model => (
                        <SelectItem key={model.value} value={model.value}>
                          <div className="flex items-center gap-2">
                            <span>{model.label}</span>
                            <Badge variant="outline" className="text-xs">{model.provider}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="persona">Persona (BAP-578 Extended Metadata)</Label>
                <Textarea
                  id="persona"
                  placeholder='{"traits": ["helpful", "professional"], "tone": "friendly", "style": "concise"}'
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  rows={2}
                  data-testid="input-persona"
                />
                <p className="text-xs text-muted-foreground">JSON describing the agent's personality traits</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="experience">Experience Description</Label>
                <Input
                  id="experience"
                  placeholder="Expert in DeFi trading and market analysis..."
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  data-testid="input-experience"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Agent Configuration
              </h3>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  {agentType === "LEARNING" ? (
                    <Brain className="h-5 w-5 text-primary" />
                  ) : (
                    <Zap className="h-5 w-5 text-amber-500" />
                  )}
                  <div>
                    <p className="font-medium">Agent Type</p>
                    <p className="text-sm text-muted-foreground">
                      {agentType === "LEARNING" 
                        ? "Can learn and evolve over time with Merkle Tree verification" 
                        : "Fixed behavior with JSON Light Memory"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Static</span>
                  <Switch
                    checked={agentType === "LEARNING"}
                    onCheckedChange={(checked) => setAgentType(checked ? "LEARNING" : "STATIC")}
                    data-testid="switch-agent-type"
                  />
                  <span className="text-sm">Learning</span>
                </div>
              </div>

              {agentType === "LEARNING" && (
                <div className="space-y-2 p-4 rounded-lg border border-primary/20 bg-primary/5">
                  <Label htmlFor="learningModule" className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Learning Module
                  </Label>
                  <Select value={learningModuleId} onValueChange={setLearningModuleId}>
                    <SelectTrigger data-testid="select-learning-module">
                      <SelectValue placeholder="Select a learning module" />
                    </SelectTrigger>
                    <SelectContent>
                      {learningModules.map(module => (
                        <SelectItem key={module.id} value={module.id}>
                          <div className="flex items-center gap-2">
                            <span>{module.name}</span>
                            <Badge variant="outline" className="text-xs">{module.moduleType}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Learning modules define how your agent processes and stores new knowledge
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="systemPrompt" className="flex items-center gap-2">
                  <Fingerprint className="h-4 w-4" />
                  System Prompt (Proof-of-Prompt)
                </Label>
                <Textarea
                  id="systemPrompt"
                  placeholder="You are a helpful AI assistant that specializes in..."
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={5}
                  data-testid="input-system-prompt"
                />
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                  <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    The system prompt will be hashed and stored on-chain as Proof-of-Prompt (PoP).
                    This provides cryptographic verification of your agent's training configuration.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="metadataUri">Metadata URI (Optional)</Label>
                <Input
                  id="metadataUri"
                  placeholder="ipfs://... or https://..."
                  value={metadataUri}
                  onChange={(e) => setMetadataUri(e.target.value)}
                  data-testid="input-metadata-uri"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Review & Mint
              </h3>

              <Card className="bg-muted/30">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{name || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium">{category || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Model</span>
                    <Badge variant="outline">{modelType}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant={agentType === "LEARNING" ? "default" : "secondary"}>
                      {agentType === "LEARNING" ? (
                        <><Brain className="h-3 w-3 mr-1" /> Learning</>
                      ) : (
                        <><Zap className="h-3 w-3 mr-1" /> Static</>
                      )}
                    </Badge>
                  </div>
                  {agentType === "LEARNING" && learningModuleId && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Learning Module</span>
                      <Badge variant="outline">
                        {learningModules.find(m => m.id === learningModuleId)?.name || "-"}
                      </Badge>
                    </div>
                  )}
                  {selectedTemplateId && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Template</span>
                      <Badge variant="outline">
                        {templates.find(t => t.id === selectedTemplateId)?.name || "-"}
                      </Badge>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Proof-of-Prompt</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {systemPrompt ? "Configured" : "Empty"}
                    </Badge>
                  </div>
                  {persona && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Persona</span>
                      <Badge variant="outline" className="text-xs">Configured</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-start gap-2 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Database className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-500">BAP-578 On-Chain Registration</p>
                  <p className="text-sm text-muted-foreground">
                    Your agent will be registered as a BAP-578 Non-Fungible Agent on BNB Chain.
                    The Proof-of-Prompt, memory root, and learning tree root will be stored on-chain.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between gap-2 border-t pt-4">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              data-testid="button-back-step"
            >
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step < 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !name.trim()}
              data-testid="button-next-step"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleMint}
              disabled={isMinting || !name.trim()}
              className="gap-2"
              data-testid="button-mint"
            >
              {isMinting ? (
                <>
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Minting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Mint NFA
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
