import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { parseEther, formatEther } from "viem";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Bot, 
  Send, 
  Loader2, 
  Coins, 
  AlertCircle, 
  CheckCircle,
  MessageSquare,
  Wallet,
  ExternalLink,
  Download
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { WalletButton } from "@/components/wallet-button";
import { queryClient, apiRequest } from "@/lib/queryClient";

// Helper to render message content with embedded images
function MessageContent({ content }: { content: string }) {
  // Parse markdown-style images: ![alt](url)
  const parts = useMemo(() => {
    const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const result: Array<{ type: "text" | "image"; value: string; alt?: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Add text before the image
      if (match.index > lastIndex) {
        result.push({ type: "text", value: content.slice(lastIndex, match.index) });
      }
      // Add the image
      result.push({ type: "image", value: match[2], alt: match[1] });
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after the last image
    if (lastIndex < content.length) {
      result.push({ type: "text", value: content.slice(lastIndex) });
    }

    return result.length > 0 ? result : [{ type: "text" as const, value: content }];
  }, [content]);

  const handleDownload = (imageUrl: string, alt: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `${alt || "generated-image"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        if (part.type === "image") {
          return (
            <div key={index} className="relative group">
              <img 
                src={part.value} 
                alt={part.alt || "Generated image"} 
                className="max-w-full rounded-lg border shadow-sm"
                style={{ maxHeight: "400px" }}
              />
              <Button
                size="sm"
                variant="secondary"
                className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDownload(part.value, part.alt || "generated-image")}
                data-testid="button-download-image"
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {part.value}
          </p>
        );
      })}
    </div>
  );
}

interface AiAgentProfile {
  id: string;
  agentId: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  capabilities: string[];
  systemPrompt: string;
  pricingModel: string;
  pricePerUnit: string;
  creatorAddress: string;
  isActive: boolean;
  totalInteractions: number;
  totalEarnings: string;
  createdAt: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  tokenCount?: number;
  pricePaid?: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
}

function formatPrice(weiAmount: string): string {
  const bnb = parseFloat(weiAmount) / 1e18;
  if (bnb < 0.0001) {
    return `${(bnb * 1e6).toFixed(2)} μBNB`;
  }
  if (bnb < 0.01) {
    return `${(bnb * 1000).toFixed(3)} mBNB`;
  }
  return `${bnb.toFixed(4)} BNB`;
}

function getPricingLabel(model: string): string {
  switch (model) {
    case "per_message":
      return "per message";
    case "per_token":
      return "per 1K tokens";
    case "per_task":
      return "per task";
    default:
      return model;
  }
}

export default function AgentChat() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const { address, isConnected } = useAccount();
  const { isAuthenticated, authenticate, isAuthenticating } = useAuth();
  const { toast } = useToast();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isPaying, setIsPaying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: agentData, isLoading: isLoadingAgent } = useQuery<AiAgentProfile>({
    queryKey: ["/api/ai-agents", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/ai-agents/${agentId}`);
      if (!res.ok) throw new Error("Agent not found");
      return res.json();
    },
    enabled: !!agentId,
  });

  const { data: conversationsData } = useQuery<{ conversations: Conversation[] }>({
    queryKey: ["/api/ai-agents", agentId, "conversations", address],
    queryFn: async () => {
      const res = await fetch(`/api/ai-agents/${agentId}/conversations?userAddress=${address}`);
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
    enabled: !!agentId && !!address,
  });

  const { data: messagesData } = useQuery<{ messages: Message[] }>({
    queryKey: ["/api/ai-agents/conversations", conversationId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/ai-agents/conversations/${conversationId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (messagesData?.messages) {
      setLocalMessages(messagesData.messages);
    }
  }, [messagesData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !agentData || !address || !walletClient || !publicClient) return;

    setIsPaying(true);
    try {
      const priceWei = BigInt(agentData.pricePerUnit);
      
      const txHash = await walletClient.sendTransaction({
        to: agentData.creatorAddress as `0x${string}`,
        value: priceWei,
      });

      toast({ title: "Payment sent, waiting for confirmation..." });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      toast({ title: "Payment confirmed! Sending message..." });
      setIsPaying(false);
      setIsSending(true);

      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages(prev => [...prev, userMessage]);
      setMessage("");

      const response = await apiRequest<{
        conversationId: string;
        response: string;
        tokenCount: number;
        pricePaid: string;
      }>("POST", `/api/ai-agents/${agentId}/execute`, {
        message: userMessage.content,
        conversationId: conversationId || undefined,
        paymentTxHash: txHash,
        userAddress: address,
      });

      if (!conversationId) {
        setConversationId(response.conversationId);
      }

      const assistantMessage: Message = {
        id: `response-${Date.now()}`,
        role: "assistant",
        content: response.response,
        tokenCount: response.tokenCount,
        pricePaid: response.pricePaid,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages(prev => [...prev, assistantMessage]);

      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents", agentId, "conversations"] });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Failed to send message",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsPaying(false);
      setIsSending(false);
    }
  };

  if (isLoadingAgent) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <Card>
          <CardHeader>
            <div className="flex gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!agentData) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <Link href="/agents" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Marketplace
        </Link>
        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Agent Not Found</h3>
            <p className="text-muted-foreground">This AI agent doesn't exist or has been deactivated.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <Link href="/agents" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Marketplace
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-20 w-20 mb-3">
                  <AvatarImage src={agentData.avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary/10">
                    <Bot className="h-10 w-10 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="text-xl">{agentData.name}</CardTitle>
                <CardDescription className="mt-1">
                  {agentData.bio || "AI-powered assistant"}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center gap-2 p-3 bg-amber-500/10 rounded-lg">
                <Coins className="h-5 w-5 text-amber-600" />
                <span className="font-semibold text-amber-600">{formatPrice(agentData.pricePerUnit)}</span>
                <span className="text-sm text-muted-foreground">{getPricingLabel(agentData.pricingModel)}</span>
              </div>

              <div className="flex justify-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  <span>{agentData.totalInteractions}</span>
                </div>
              </div>

              {agentData.capabilities && agentData.capabilities.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1">
                  {agentData.capabilities.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="text-xs text-muted-foreground text-center">
                Creator: {agentData.creatorAddress.slice(0, 6)}...{agentData.creatorAddress.slice(-4)}
              </div>
            </CardContent>
          </Card>

          {conversationsData?.conversations && conversationsData.conversations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Your Conversations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {conversationsData.conversations.slice(0, 5).map((conv) => (
                  <Button
                    key={conv.id}
                    variant={conversationId === conv.id ? "secondary" : "ghost"}
                    className="w-full justify-start text-left h-auto py-2"
                    onClick={() => setConversationId(conv.id)}
                    data-testid={`button-conversation-${conv.id}`}
                  >
                    <span className="truncate text-sm">{conv.title || "New conversation"}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card className="flex flex-col h-[600px]">
            <CardHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Chat with {agentData.name}
                </CardTitle>
                {conversationId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setConversationId(null);
                      setLocalMessages([]);
                    }}
                    data-testid="button-new-chat"
                  >
                    New Chat
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {localMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                  <Bot className="h-12 w-12 mb-3 opacity-50" />
                  <p className="mb-2">Start a conversation with {agentData.name}</p>
                  <p className="text-sm">Each message costs {formatPrice(agentData.pricePerUnit)}</p>
                </div>
              ) : (
                localMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <MessageContent content={msg.content} />
                      {msg.role === "assistant" && msg.tokenCount && (
                        <p className="text-xs mt-1 opacity-70">
                          {msg.tokenCount} tokens
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </CardContent>

            <div className="p-4 border-t">
              {!isConnected ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Wallet className="h-5 w-5" />
                    <span>Connect your wallet to chat</span>
                  </div>
                  <WalletButton />
                </div>
              ) : !isAuthenticated ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-muted-foreground">Sign in to start chatting</p>
                  <Button
                    onClick={() => authenticate()}
                    disabled={isAuthenticating}
                    data-testid="button-sign-in-chat"
                  >
                    {isAuthenticating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              ) : !agentData.isActive ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-5 w-5" />
                  <span>This agent is currently not accepting messages</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <Textarea
                    placeholder={`Message ${agentData.name}...`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="resize-none"
                    rows={3}
                    disabled={isPaying || isSending}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    data-testid="input-message"
                  />
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Cost: {formatPrice(agentData.pricePerUnit)} per message
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      disabled={!message.trim() || isPaying || isSending}
                      data-testid="button-send-message"
                    >
                      {isPaying ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Paying...
                        </>
                      ) : isSending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send ({formatPrice(agentData.pricePerUnit)})
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
