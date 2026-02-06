import { useChainId } from "wagmi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useERC8004AgentURI, useERC8004AgentOwner, useERC8004GetClients, useERC8004GetSummary } from "@/contracts/hooks";
import { getERC8004Addresses } from "@/contracts/addresses";
import { ERC8004TrustBadge, ERC8004TrustIndicator } from "./erc8004-trust-badge";
import { 
  Hexagon, 
  ExternalLink, 
  Copy, 
  Check,
  Globe,
  User,
  Loader2,
  Shield,
  Link2
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ERC8004IdentityPassportProps {
  agentId: bigint;
  agentName?: string;
  agentImage?: string;
  compact?: boolean;
  className?: string;
}

export function ERC8004IdentityPassport({ 
  agentId, 
  agentName,
  agentImage,
  compact = false,
  className = ""
}: ERC8004IdentityPassportProps) {
  const chainId = useChainId();
  const addresses = getERC8004Addresses(chainId);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const { data: agentURI, isLoading: uriLoading } = useERC8004AgentURI(agentId);
  const { data: owner, isLoading: ownerLoading } = useERC8004AgentOwner(agentId);
  const { data: clients } = useERC8004GetClients(agentId);
  
  const hasClients = clients && Array.isArray(clients) && clients.length > 0;
  const { data: summary } = useERC8004GetSummary(
    hasClients ? agentId : undefined,
    hasClients ? (clients as `0x${string}`[]) : undefined,
    "",
    ""
  );

  if (!addresses) {
    return null;
  }

  const isLoading = uriLoading || ownerLoading;
  const feedbackCount = summary ? Number(summary[0]) : 0;

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const getNetworkName = () => {
    if (chainId === 56) return "BSC Mainnet";
    if (chainId === 97) return "BSC Testnet";
    return "Unknown Network";
  };

  if (compact) {
    return (
      <div 
        className={`flex items-center gap-3 p-3 rounded-lg border bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-amber-500/20 ${className}`}
        data-testid={`passport-compact-${agentId}`}
      >
        <div className="p-2 rounded-full bg-amber-500/10">
          <Hexagon className="h-5 w-5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">ERC-8004 Identity</span>
            <ERC8004TrustBadge agentId={agentId} size="sm" showLabel={false} />
          </div>
          <p className="text-sm font-mono truncate">
            Agent #{agentId.toString()}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {feedbackCount} feedback{feedbackCount !== 1 ? 's' : ''}
        </Badge>
      </div>
    );
  }

  return (
    <Card 
      className={`overflow-hidden border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5 ${className}`}
      data-testid={`passport-${agentId}`}
    >
      <div className="p-4 border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            {agentImage ? (
              <img 
                src={agentImage} 
                alt={agentName || `Agent ${agentId}`}
                className="h-12 w-12 rounded-full object-cover border-2 border-amber-500/30"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center border-2 border-amber-500/30">
                <Hexagon className="h-6 w-6 text-amber-500" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-background border border-amber-500/30">
              <Shield className="h-3 w-3 text-amber-500" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                ERC-8004 Agent Passport
              </span>
            </div>
            <h3 className="font-semibold truncate">
              {agentName || `Agent #${agentId.toString()}`}
            </h3>
          </div>
          <ERC8004TrustBadge agentId={agentId} size="md" />
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Hexagon className="h-3 w-3" />
                  Agent ID
                </p>
                <p className="font-mono text-sm font-medium">#{agentId.toString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  Network
                </p>
                <p className="text-sm font-medium">{getNetworkName()}</p>
              </div>
            </div>

            {owner && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Owner
                </p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm">{shortenAddress(owner as string)}</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(owner as string)}
                        data-testid="button-copy-owner"
                      >
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy address</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}

            {agentURI && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  Metadata URI
                </p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs truncate flex-1">{agentURI as string}</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => window.open(agentURI as string, '_blank')}
                        data-testid="button-open-uri"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open metadata</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}

            <div className="pt-3 border-t">
              <ERC8004TrustIndicator agentId={agentId} />
            </div>

            <div className="pt-3 border-t flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Registry: {shortenAddress(addresses.identityRegistry || '')}
              </p>
              <a 
                href={`https://bscscan.com/address/${addresses.identityRegistry}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-500 flex items-center gap-1"
              >
                View on BscScan
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface ERC8004IdentityBannerProps {
  agentId: bigint;
  agentName?: string;
  className?: string;
}

export function ERC8004IdentityBanner({ agentId, agentName, className = "" }: ERC8004IdentityBannerProps) {
  const chainId = useChainId();
  const addresses = getERC8004Addresses(chainId);

  if (!addresses) {
    return null;
  }

  return (
    <div 
      className={`flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 ${className}`}
      data-testid={`banner-identity-${agentId}`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-amber-500/20">
          <Hexagon className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide">
            ERC-8004 Verified
          </p>
          <p className="text-sm font-medium">
            {agentName || `Agent #${agentId.toString()}`}
          </p>
        </div>
      </div>
      <ERC8004TrustBadge agentId={agentId} size="md" />
    </div>
  );
}
