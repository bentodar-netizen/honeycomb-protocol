import { useEffect, useState } from "react";
import { useChainId } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useERC8004GetClients, useERC8004GetSummary } from "@/contracts/hooks";
import { getERC8004Addresses } from "@/contracts/addresses";
import { Star, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

interface ERC8004ReputationBadgeProps {
  agentId: bigint;
  showCount?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ERC8004ReputationBadge({ 
  agentId, 
  showCount = true, 
  size = "md",
  className = ""
}: ERC8004ReputationBadgeProps) {
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

  const getScoreColor = () => {
    if (count === 0) return "text-muted-foreground";
    if (value >= 0.7) return "text-green-500";
    if (value >= 0.4) return "text-amber-500";
    return "text-red-500";
  };

  const getScoreIcon = () => {
    if (count === 0) return <Star className={iconSize} />;
    if (value >= 0.5) return <TrendingUp className={iconSize} />;
    if (value >= 0) return <Minus className={iconSize} />;
    return <TrendingDown className={iconSize} />;
  };

  const iconSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const textSize = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";

  const displayScore = count === 0 ? "N/A" : (value * 100).toFixed(0) + "%";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={`gap-1 ${getScoreColor()} ${className}`}
          data-testid={`badge-reputation-${agentId}`}
        >
          {getScoreIcon()}
          <span className={textSize}>{displayScore}</span>
          {showCount && count > 0 && (
            <span className="text-muted-foreground text-xs">({count})</span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-medium">ERC-8004 Reputation</p>
          <p className="text-xs text-muted-foreground">
            {count === 0 
              ? "No feedback yet" 
              : `${count} feedback${count > 1 ? 's' : ''} received`
            }
          </p>
          {count > 0 && (
            <p className="text-xs">Aggregate score: {displayScore}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface ERC8004ReputationScoreProps {
  agentId: bigint;
  className?: string;
}

export function ERC8004ReputationScore({ agentId, className = "" }: ERC8004ReputationScoreProps) {
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
        <span className="text-sm text-muted-foreground">Loading reputation...</span>
      </div>
    );
  }

  const count = summary ? Number(summary[0]) : 0;
  const rawValue = summary ? Number(summary[1]) : 0;
  const decimals = summary ? Number(summary[2]) : 0;
  const value = decimals > 0 ? rawValue / Math.pow(10, decimals) : rawValue;

  const normalizedScore = Math.max(0, Math.min(100, (value + 1) * 50));

  return (
    <div className={`space-y-2 ${className}`} data-testid={`score-reputation-${agentId}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Reputation Score</span>
        <span className="text-sm text-muted-foreground">
          {count} feedback{count !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
        <div 
          className="absolute h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
          style={{ width: count === 0 ? '0%' : `${normalizedScore}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Poor</span>
        <span className="font-medium text-foreground">
          {count === 0 ? "No ratings" : `${normalizedScore.toFixed(0)}% positive`}
        </span>
        <span>Excellent</span>
      </div>
    </div>
  );
}
