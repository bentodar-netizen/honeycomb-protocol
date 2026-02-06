import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useERC8004GiveFeedback } from "@/contracts/hooks";
import { getERC8004Addresses } from "@/contracts/addresses";
import { 
  Star, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Meh
} from "lucide-react";
import { keccak256, toBytes } from "viem";
import { WalletButton } from "@/components/wallet-button";

interface ERC8004FeedbackFormProps {
  agentId: bigint;
  endpoint?: string;
  onSuccess?: () => void;
}

type FeedbackRating = "positive" | "neutral" | "negative";

export function ERC8004FeedbackForm({ agentId, endpoint = "", onSuccess }: ERC8004FeedbackFormProps) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();
  const addresses = getERC8004Addresses(chainId);
  
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [comment, setComment] = useState("");

  const { giveFeedback, hash, isPending, isConfirming, isSuccess, error } = useERC8004GiveFeedback();

  const getRatingValue = (r: FeedbackRating): bigint => {
    switch (r) {
      case "positive": return BigInt(100);
      case "neutral": return BigInt(0);
      case "negative": return BigInt(-100);
    }
  };

  const handleSubmit = () => {
    if (!rating) {
      toast({
        title: "Rating Required",
        description: "Please select a rating before submitting",
        variant: "destructive",
      });
      return;
    }

    try {
      const feedbackContent = JSON.stringify({
        rating,
        comment,
        timestamp: Date.now(),
        agent: agentId.toString(),
      });
      const feedbackHash = keccak256(toBytes(feedbackContent)) as `0x${string}`;

      giveFeedback(
        agentId,
        getRatingValue(rating),
        2,
        "general",
        "",
        endpoint,
        "",
        feedbackHash
      );
    } catch (err) {
      toast({
        title: "Feedback Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (isSuccess && onSuccess) {
    onSuccess();
  }

  if (!addresses) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-3 text-amber-500" />
          <p className="text-muted-foreground">ERC-8004 not available on this network</p>
        </CardContent>
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Star className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">Connect wallet to leave feedback</p>
          <WalletButton />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" />
          Leave Feedback
        </CardTitle>
        <CardDescription>
          Rate this agent on the ERC-8004 Reputation Registry
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>How was your experience?</Label>
          <div className="flex flex-wrap gap-3">
            <Button
              variant={rating === "positive" ? "default" : "outline"}
              className={rating === "positive" ? "bg-green-500 text-white" : ""}
              onClick={() => setRating("positive")}
              data-testid="button-rating-positive"
            >
              <ThumbsUp className="h-4 w-4 mr-2" />
              Positive
            </Button>
            <Button
              variant={rating === "neutral" ? "default" : "outline"}
              className={rating === "neutral" ? "bg-amber-500 text-white" : ""}
              onClick={() => setRating("neutral")}
              data-testid="button-rating-neutral"
            >
              <Meh className="h-4 w-4 mr-2" />
              Neutral
            </Button>
            <Button
              variant={rating === "negative" ? "default" : "outline"}
              className={rating === "negative" ? "bg-red-500 text-white" : ""}
              onClick={() => setRating("negative")}
              data-testid="button-rating-negative"
            >
              <ThumbsDown className="h-4 w-4 mr-2" />
              Negative
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="comment">Comment (optional)</Label>
          <Textarea
            id="comment"
            placeholder="Share your experience with this agent..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[80px]"
            data-testid="input-feedback-comment"
          />
          <p className="text-xs text-muted-foreground">
            Your feedback is stored on-chain as a hash. The full content is stored off-chain.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Feedback Failed</p>
              <p className="text-xs text-muted-foreground">{error.message}</p>
            </div>
          </div>
        )}

        {isSuccess && hash && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Feedback Submitted!
              </p>
              <a 
                href={`https://${chainId === 97 ? 'testnet.' : ''}bscscan.com/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
              >
                View transaction <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        <Button 
          onClick={handleSubmit}
          disabled={isPending || isConfirming || !rating}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white"
          data-testid="button-submit-feedback"
        >
          {isPending || isConfirming ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isConfirming ? "Confirming..." : "Submitting..."}
            </>
          ) : (
            <>
              <Star className="h-4 w-4 mr-2" />
              Submit Feedback
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
