import { useChainId } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useERC8004GetClients, useERC8004GetSummary } from "@/contracts/hooks";
import { getERC8004Addresses } from "@/contracts/addresses";
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Crown, 
  Loader2,
  Sparkles
} from "lucide-react";

export type TrustLevel = "newcomer" | "emerging" | "trusted" | "verified" | "elite";

interface TrustLevelConfig {
  label: string;
  description: string;
  icon: typeof Shield;
  minFeedback: number;
  minScore: number;
  color: string;
  badgeVariant: "outline" | "secondary" | "default";
}

const TRUST_LEVELS: Record<TrustLevel, TrustLevelConfig> = {
  newcomer: {
    label: "Newcomer",
    description: "New agent with limited history",
    icon: Shield,
    minFeedback: 0,
    minScore: 0,
    color: "text-muted-foreground",
    badgeVariant: "outline"
  },
  emerging: {
    label: "Emerging",
    description: "Building reputation with initial feedback",
    icon: Shield,
    minFeedback: 3,
    minScore: 40,
    color: "text-blue-500",
    badgeVariant: "outline"
  },
  trusted: {
    label: "Trusted",
    description: "Established agent with positive track record",
    icon: ShieldCheck,
    minFeedback: 10,
    minScore: 60,
    color: "text-green-500",
    badgeVariant: "secondary"
  },
  verified: {
    label: "Verified",
    description: "Highly rated agent with extensive history",
    icon: ShieldCheck,
    minFeedback: 25,
    minScore: 75,
    color: "text-amber-500",
    badgeVariant: "default"
  },
  elite: {
    label: "Elite",
    description: "Top-tier agent with exceptional reputation",
    icon: Crown,
    minFeedback: 50,
    minScore: 90,
    color: "text-purple-500",
    badgeVariant: "default"
  }
};

function calculateTrustLevel(feedbackCount: number, score: number): TrustLevel {
  const levels: TrustLevel[] = ["elite", "verified", "trusted", "emerging", "newcomer"];
  
  for (const level of levels) {
    const config = TRUST_LEVELS[level];
    if (feedbackCount >= config.minFeedback && score >= config.minScore) {
      return level;
    }
  }
  
  return "newcomer";
}

interface ERC8004TrustBadgeProps {
  agentId: bigint;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function ERC8004TrustBadge({ 
  agentId, 
  size = "md",
  showLabel = true,
  className = ""
}: ERC8004TrustBadgeProps) {
  const chainId = useChainId();
  const addresses = getERC8004Addresses(chainId);
  
  const { data: clients, isLoading: clientsLoading } = useERC8004GetClients(agentId);
  
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

  const isLoading = clientsLoading || (hasClients && summaryLoading);

  if (isLoading) {
    return (
      <Badge variant="outline" className={`gap-1 ${className}`}>
        <Loader2 className="h-3 w-3 animate-spin" />
      </Badge>
    );
  }

  const count = summary ? Number(summary[0]) : 0;
  const rawValue = summary ? Number(summary[1]) : 0;
  const decimals = summary ? Number(summary[2]) : 0;
  const value = decimals > 0 ? rawValue / Math.pow(10, decimals) : rawValue;
  
  const normalizedScore = Math.max(0, Math.min(100, (value + 1) * 50));
  const trustLevel = calculateTrustLevel(count, normalizedScore);
  const config = TRUST_LEVELS[trustLevel];
  const Icon = config.icon;

  const iconSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const textSize = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant={config.badgeVariant}
          className={`gap-1.5 ${config.color} ${className}`}
          data-testid={`badge-trust-${agentId}`}
        >
          <Icon className={iconSize} />
          {showLabel && <span className={textSize}>{config.label}</span>}
          {trustLevel === "elite" && <Sparkles className="h-3 w-3" />}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1.5 max-w-xs">
          <p className="font-medium flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {config.label} Agent
          </p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
          <div className="pt-1 border-t border-border">
            <p className="text-xs">
              <span className="text-muted-foreground">Feedback count:</span> {count}
            </p>
            <p className="text-xs">
              <span className="text-muted-foreground">Trust score:</span> {normalizedScore.toFixed(0)}%
            </p>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface ERC8004TrustIndicatorProps {
  agentId: bigint;
  className?: string;
}

export function ERC8004TrustIndicator({ agentId, className = "" }: ERC8004TrustIndicatorProps) {
  const chainId = useChainId();
  const addresses = getERC8004Addresses(chainId);
  
  const { data: clients, isLoading: clientsLoading } = useERC8004GetClients(agentId);
  
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

  const isLoading = clientsLoading || (hasClients && summaryLoading);

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  const count = summary ? Number(summary[0]) : 0;
  const rawValue = summary ? Number(summary[1]) : 0;
  const decimals = summary ? Number(summary[2]) : 0;
  const value = decimals > 0 ? rawValue / Math.pow(10, decimals) : rawValue;
  
  const normalizedScore = Math.max(0, Math.min(100, (value + 1) * 50));
  const trustLevel = calculateTrustLevel(count, normalizedScore);
  const config = TRUST_LEVELS[trustLevel];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-3 ${className}`} data-testid={`indicator-trust-${agentId}`}>
      <div className={`p-2 rounded-full bg-secondary ${config.color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-medium flex items-center gap-1.5">
          {config.label}
          {trustLevel === "elite" && <Sparkles className="h-4 w-4 text-purple-500" />}
        </p>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </div>
    </div>
  );
}
