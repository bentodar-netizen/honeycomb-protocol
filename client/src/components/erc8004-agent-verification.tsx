import { useState } from "react";
import { useChainId, useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useERC8004AgentOwner, useERC8004AgentURI, useERC8004GetClients, useERC8004GetSummary } from "@/contracts/hooks";
import { getERC8004Addresses } from "@/contracts/addresses";
import { ERC8004TrustBadge } from "./erc8004-trust-badge";
import { 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldQuestion,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Hexagon,
  Users
} from "lucide-react";

interface VerificationResult {
  agentId: bigint;
  exists: boolean;
  owner?: string;
  uri?: string;
  feedbackCount: number;
  trustScore: number;
  isVerified: boolean;
}

interface ERC8004AgentVerificationProps {
  className?: string;
  onVerificationComplete?: (result: VerificationResult) => void;
}

export function ERC8004AgentVerification({ 
  className = "",
  onVerificationComplete 
}: ERC8004AgentVerificationProps) {
  const chainId = useChainId();
  const addresses = getERC8004Addresses(chainId);
  const [agentIdInput, setAgentIdInput] = useState("");
  const [verifyAgentId, setVerifyAgentId] = useState<bigint | null>(null);
  const [verificationComplete, setVerificationComplete] = useState(false);

  const { data: owner, isLoading: ownerLoading, isError: ownerError } = useERC8004AgentOwner(
    verifyAgentId !== null ? verifyAgentId : undefined
  );
  const { data: uri } = useERC8004AgentURI(verifyAgentId !== null ? verifyAgentId : undefined);
  const { data: clients } = useERC8004GetClients(verifyAgentId !== null ? verifyAgentId : undefined);
  
  const hasClients = clients && Array.isArray(clients) && clients.length > 0;
  const { data: summary, isLoading: summaryLoading } = useERC8004GetSummary(
    hasClients && verifyAgentId !== null ? verifyAgentId : undefined,
    hasClients ? (clients as `0x${string}`[]) : undefined,
    "",
    ""
  );

  if (!addresses) {
    return null;
  }

  const handleVerify = () => {
    if (!agentIdInput.trim()) return;
    try {
      const id = BigInt(agentIdInput);
      setVerifyAgentId(id);
      setVerificationComplete(false);
    } catch {
      // Invalid number
    }
  };

  const handleReset = () => {
    setAgentIdInput("");
    setVerifyAgentId(null);
    setVerificationComplete(false);
  };

  const isLoading = ownerLoading || (hasClients && summaryLoading);
  const agentExists = owner && owner !== "0x0000000000000000000000000000000000000000";

  const feedbackCount = summary ? Number(summary[0]) : 0;
  const rawValue = summary ? Number(summary[1]) : 0;
  const decimals = summary ? Number(summary[2]) : 0;
  const value = decimals > 0 ? rawValue / Math.pow(10, decimals) : rawValue;
  const trustScore = Math.max(0, Math.min(100, (value + 1) * 50));

  const getVerificationStatus = () => {
    if (!agentExists) return "not_found";
    if (feedbackCount >= 10 && trustScore >= 60) return "trusted";
    if (feedbackCount >= 3 && trustScore >= 40) return "emerging";
    if (feedbackCount > 0) return "limited";
    return "new";
  };

  const verificationStatus = getVerificationStatus();

  const getStatusConfig = () => {
    switch (verificationStatus) {
      case "trusted":
        return {
          icon: ShieldCheck,
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/20",
          label: "Trusted Agent",
          description: "This agent has a strong reputation with verified positive interactions"
        };
      case "emerging":
        return {
          icon: ShieldCheck,
          color: "text-blue-500",
          bgColor: "bg-blue-500/10",
          borderColor: "border-blue-500/20",
          label: "Emerging Agent",
          description: "This agent is building reputation with positive initial feedback"
        };
      case "limited":
        return {
          icon: ShieldQuestion,
          color: "text-amber-500",
          bgColor: "bg-amber-500/10",
          borderColor: "border-amber-500/20",
          label: "Limited History",
          description: "This agent has some feedback but limited track record"
        };
      case "new":
        return {
          icon: ShieldQuestion,
          color: "text-muted-foreground",
          bgColor: "bg-secondary",
          borderColor: "border-border",
          label: "New Agent",
          description: "This agent has no feedback history yet"
        };
      case "not_found":
      default:
        return {
          icon: ShieldAlert,
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/20",
          label: "Agent Not Found",
          description: "No agent found with this ID in the ERC-8004 registry"
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <Card className={className} data-testid="card-agent-verification">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-amber-500" />
          Agent-to-Agent Verification
        </CardTitle>
        <CardDescription>
          Verify another agent's identity and reputation before interacting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="agent-id-verify" className="sr-only">Agent ID</Label>
            <Input
              id="agent-id-verify"
              type="number"
              placeholder="Enter Agent ID to verify..."
              value={agentIdInput}
              onChange={(e) => setAgentIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              data-testid="input-verify-agent-id"
            />
          </div>
          <Button onClick={handleVerify} disabled={!agentIdInput.trim()} data-testid="button-verify-agent">
            <Search className="h-4 w-4 mr-2" />
            Verify
          </Button>
        </div>

        {verifyAgentId !== null && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Verifying agent...</span>
              </div>
            ) : (
              <div className={`p-4 rounded-lg border ${statusConfig.bgColor} ${statusConfig.borderColor}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${statusConfig.bgColor}`}>
                    <StatusIcon className={`h-6 w-6 ${statusConfig.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`font-medium ${statusConfig.color}`}>
                        {statusConfig.label}
                      </h4>
                      {agentExists && verifyAgentId !== null && (
                        <ERC8004TrustBadge agentId={verifyAgentId} size="sm" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {statusConfig.description}
                    </p>

                    {agentExists && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-4 flex-wrap text-sm">
                          <div className="flex items-center gap-2">
                            <Hexagon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">ID:</span>
                            <span className="font-mono">#{verifyAgentId.toString()}</span>
                          </div>
                          {owner && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Owner:</span>
                              <span className="font-mono">{shortenAddress(owner as string)}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4 flex-wrap text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Feedback:</span>
                            <Badge variant="outline">{feedbackCount}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Trust Score:</span>
                            <Badge variant={trustScore >= 60 ? "default" : "secondary"}>
                              {feedbackCount > 0 ? `${trustScore.toFixed(0)}%` : "N/A"}
                            </Badge>
                          </div>
                        </div>

                        <div className="pt-3 mt-3 border-t flex items-center gap-3 flex-wrap">
                          {verificationStatus === "trusted" || verificationStatus === "emerging" ? (
                            <div className="flex items-center gap-2 text-green-500 text-sm">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Safe to interact</span>
                            </div>
                          ) : verificationStatus === "not_found" ? (
                            <div className="flex items-center gap-2 text-red-500 text-sm">
                              <XCircle className="h-4 w-4" />
                              <span>Cannot verify identity</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-amber-500 text-sm">
                              <AlertCircle className="h-4 w-4" />
                              <span>Proceed with caution</span>
                            </div>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleReset}
                            data-testid="button-verify-another"
                          >
                            Verify another
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {!agentExists && (
                      <div className="mt-4 pt-3 border-t">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleReset}
                          data-testid="button-try-again"
                        >
                          Try another ID
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!verifyAgentId && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <p>Enter an Agent ID to verify its on-chain identity and reputation</p>
            <p className="text-xs mt-1">
              This checks the ERC-8004 registry on {chainId === 56 ? 'BSC Mainnet' : 'BSC Testnet'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ERC8004QuickVerifyProps {
  agentId: bigint;
  onResult?: (trusted: boolean) => void;
  className?: string;
}

export function ERC8004QuickVerify({ agentId, onResult, className = "" }: ERC8004QuickVerifyProps) {
  const chainId = useChainId();
  const addresses = getERC8004Addresses(chainId);
  
  const { data: owner, isLoading: ownerLoading } = useERC8004AgentOwner(agentId);
  const { data: clients } = useERC8004GetClients(agentId);
  
  const hasClients = clients && Array.isArray(clients) && clients.length > 0;
  const { data: summary, isLoading: summaryLoading } = useERC8004GetSummary(
    hasClients ? agentId : undefined,
    hasClients ? (clients as `0x${string}`[]) : undefined,
    "",
    ""
  );

  if (!addresses) {
    return null;
  }

  const isLoading = ownerLoading || (hasClients && summaryLoading);
  const agentExists = owner && owner !== "0x0000000000000000000000000000000000000000";

  const feedbackCount = summary ? Number(summary[0]) : 0;
  const rawValue = summary ? Number(summary[1]) : 0;
  const decimals = summary ? Number(summary[2]) : 0;
  const value = decimals > 0 ? rawValue / Math.pow(10, decimals) : rawValue;
  const trustScore = Math.max(0, Math.min(100, (value + 1) * 50));

  const isTrusted = agentExists && feedbackCount >= 10 && trustScore >= 60;

  if (isLoading) {
    return (
      <Badge variant="outline" className={`gap-1 ${className}`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Verifying...
      </Badge>
    );
  }

  if (!agentExists) {
    return (
      <Badge variant="outline" className={`gap-1 text-red-500 ${className}`}>
        <ShieldAlert className="h-3 w-3" />
        Not Found
      </Badge>
    );
  }

  return (
    <Badge 
      variant={isTrusted ? "default" : "outline"} 
      className={`gap-1 ${isTrusted ? "text-green-500" : "text-amber-500"} ${className}`}
      data-testid={`quick-verify-${agentId}`}
    >
      {isTrusted ? (
        <>
          <ShieldCheck className="h-3 w-3" />
          Verified
        </>
      ) : (
        <>
          <ShieldQuestion className="h-3 w-3" />
          Unverified
        </>
      )}
    </Badge>
  );
}
