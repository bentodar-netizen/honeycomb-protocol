import { useChainId } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useERC8004GetClients, useERC8004ReadAllFeedback } from "@/contracts/hooks";
import { getERC8004Addresses } from "@/contracts/addresses";
import { 
  Clock, 
  ThumbsUp, 
  ThumbsDown, 
  Minus, 
  Loader2, 
  Activity,
  ExternalLink,
  User
} from "lucide-react";

interface ERC8004ActivityHistoryProps {
  agentId: bigint;
  className?: string;
  maxItems?: number;
}

interface FeedbackItem {
  client: string;
  value: bigint;
  tag1: string;
  tag2: string;
  endpoint: string;
  feedbackHash: string;
}

export function ERC8004ActivityHistory({ 
  agentId, 
  className = "",
  maxItems = 10
}: ERC8004ActivityHistoryProps) {
  const chainId = useChainId();
  const addresses = getERC8004Addresses(chainId);
  
  const { data: clients, isLoading: clientsLoading } = useERC8004GetClients(agentId);
  
  const hasClients = clients && Array.isArray(clients) && clients.length > 0;
  const { data: feedbackData, isLoading: feedbackLoading } = useERC8004ReadAllFeedback(
    hasClients ? agentId : undefined,
    hasClients ? (clients as `0x${string}`[]) : undefined,
    "",
    ""
  );

  if (!addresses) {
    return null;
  }

  const isLoading = clientsLoading || (hasClients && feedbackLoading);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-amber-500" />
            Activity History
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const feedbackItems: FeedbackItem[] = [];
  
  if (feedbackData && Array.isArray(feedbackData) && clients && Array.isArray(clients)) {
    for (let i = 0; i < Math.min(feedbackData.length, clients.length); i++) {
      const feedback = feedbackData[i] as [bigint, number, string, string, string, string, string];
      if (feedback && Array.isArray(feedback) && feedback.length >= 6) {
        feedbackItems.push({
          client: clients[i] as string,
          value: feedback[0],
          tag1: feedback[2],
          tag2: feedback[3],
          endpoint: feedback[4],
          feedbackHash: feedback[5]
        });
      }
    }
  }

  const displayItems = feedbackItems.slice(0, maxItems);

  const getFeedbackIcon = (value: bigint) => {
    const num = Number(value);
    if (num > 0) return <ThumbsUp className="h-4 w-4 text-green-500" />;
    if (num < 0) return <ThumbsDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-amber-500" />;
  };

  const getFeedbackLabel = (value: bigint) => {
    const num = Number(value);
    if (num > 0) return "Positive";
    if (num < 0) return "Negative";
    return "Neutral";
  };

  const getFeedbackColor = (value: bigint) => {
    const num = Number(value);
    if (num > 0) return "border-green-500/20 bg-green-500/5";
    if (num < 0) return "border-red-500/20 bg-red-500/5";
    return "border-amber-500/20 bg-amber-500/5";
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <Card className={className} data-testid="card-activity-history">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-amber-500" />
          Activity History
        </CardTitle>
        <CardDescription>
          On-chain feedback and interactions from the ERC-8004 registry
        </CardDescription>
      </CardHeader>
      <CardContent>
        {displayItems.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Feedback will appear here as users interact with this agent
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayItems.map((item, index) => (
              <div 
                key={`${item.client}-${index}`}
                className={`flex items-start gap-3 p-3 rounded-md border ${getFeedbackColor(item.value)}`}
                data-testid={`activity-item-${index}`}
              >
                <div className="mt-0.5">
                  {getFeedbackIcon(item.value)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {getFeedbackLabel(item.value)}
                    </Badge>
                    {item.tag1 && item.tag1 !== "general" && (
                      <Badge variant="secondary" className="text-xs">
                        {item.tag1}
                      </Badge>
                    )}
                    {item.tag2 && (
                      <Badge variant="secondary" className="text-xs">
                        {item.tag2}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span className="font-mono">{shortenAddress(item.client)}</span>
                    {item.endpoint && (
                      <>
                        <span>•</span>
                        <a 
                          href={item.endpoint}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View context
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {feedbackItems.length > maxItems && (
              <p className="text-xs text-center text-muted-foreground pt-2">
                Showing {maxItems} of {feedbackItems.length} activities
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
