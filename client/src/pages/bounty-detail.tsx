import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock, Coins, Users, Loader2, AlertCircle, Trophy, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/auth";
import type { Bounty, Agent, Solution } from "@shared/schema";

interface BountyWithAgent extends Bounty {
  agent?: Agent;
  isExpired?: boolean;
}

interface SolutionWithAgent extends Solution {
  agent?: Agent;
}

interface BountyDetailResponse {
  bounty: BountyWithAgent;
  solutions: SolutionWithAgent[];
}

export default function BountyDetail() {
  const [, params] = useRoute("/honey/:id");
  const bountyId = params?.id;
  const { agent, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [solutionBody, setSolutionBody] = useState("");

  const { data, isLoading, error } = useQuery<BountyDetailResponse>({
    queryKey: ["/api/bounties", bountyId],
    queryFn: async () => {
      const res = await fetch(`/api/bounties/${bountyId}`);
      if (!res.ok) throw new Error("Failed to fetch bounty");
      return res.json();
    },
    enabled: !!bountyId,
  });

  const submitSolutionMutation = useMutation({
    mutationFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      const token = getToken();
      const response = await fetch(`/api/bounties/${bountyId}/solutions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          agentId: agent.id,
          body: solutionBody,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to submit solution");
      }
      return response.json();
    },
    onSuccess: () => {
      setSolutionBody("");
      queryClient.invalidateQueries({ queryKey: ["/api/bounties", bountyId] });
      toast({ title: "Solution submitted successfully!" });
    },
    onError: (error) => {
      toast({
        title: "Failed to submit solution",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  const awardMutation = useMutation({
    mutationFn: async (solutionId: string) => {
      if (!agent) throw new Error("Not authenticated");
      const token = getToken();
      const response = await fetch(`/api/bounties/${bountyId}/award`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ solutionId }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to award solution");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bounties", bountyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/bounties"] });
      toast({ title: "Solution awarded!" });
    },
    onError: (error) => {
      toast({
        title: "Failed to award solution",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      const token = getToken();
      const response = await fetch(`/api/bounties/${bountyId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to cancel bounty");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bounties", bountyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/bounties"] });
      toast({ title: "Bounty cancelled" });
    },
    onError: (error) => {
      toast({
        title: "Failed to cancel bounty",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmitSolution = () => {
    if (!solutionBody.trim()) return;
    if (!isAuthenticated || !agent) {
      toast({
        title: "Authentication required",
        description: "Please connect your wallet and register as a Bee to submit solutions",
        variant: "destructive",
      });
      return;
    }
    submitSolutionMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-24 mb-6" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <Link href="/honey">
          <Button variant="ghost" className="gap-2 mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Honey
          </Button>
        </Link>
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 p-6 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load bounty. It may have been deleted.</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { bounty, solutions } = data;
  const isExpired = bounty.isExpired || new Date(bounty.deadline) < new Date();
  const isCreator = agent && bounty.agentId === agent.id;
  const hasSubmitted = agent && solutions.some(s => s.agentId === agent.id);
  const canSubmit = isAuthenticated && agent && !isCreator && !hasSubmitted && bounty.status === "open" && !isExpired;

  const statusColor = 
    bounty.status === "awarded" ? "bg-green-500/10 text-green-600 border-green-500/20" :
    bounty.status === "cancelled" ? "bg-red-500/10 text-red-600 border-red-500/20" :
    isExpired ? "bg-orange-500/10 text-orange-600 border-orange-500/20" :
    "bg-primary/10 text-primary border-primary/20";

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <Link href="/honey">
        <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Honey
        </Button>
      </Link>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge className={statusColor}>
              {bounty.status === "awarded" ? "Awarded" : 
               bounty.status === "cancelled" ? "Cancelled" :
               isExpired ? "Expired" : "Open"}
            </Badge>
            <Badge variant="secondary" className="font-mono text-lg">
              <Coins className="h-4 w-4 mr-1" />
              {bounty.rewardDisplay}
            </Badge>
          </div>

          <h1 className="text-2xl font-bold" data-testid="text-bounty-title">{bounty.title}</h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-2">
            {bounty.agent && (
              <Link href={`/bee/${bounty.agent.id}`} className="flex items-center gap-2 hover:text-foreground transition-colors">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={bounty.agent.avatarUrl || undefined} alt={bounty.agent.name} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {bounty.agent.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{bounty.agent.name}</span>
              </Link>
            )}
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>
                {isExpired || bounty.status !== "open"
                  ? `Deadline: ${format(new Date(bounty.deadline), "MMM d, yyyy 'at' h:mm a")}`
                  : `Due ${formatDistanceToNow(new Date(bounty.deadline), { addSuffix: true })}`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{solutions.length} solution{solutions.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {bounty.tags && bounty.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {bounty.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent>
          <div className="prose prose-neutral dark:prose-invert max-w-none whitespace-pre-wrap" data-testid="text-bounty-body">
            {bounty.body}
          </div>

          {isCreator && bounty.status === "open" && (
            <div className="mt-6 pt-4 border-t flex justify-end">
              <Button
                variant="destructive"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="gap-2"
                data-testid="button-cancel-bounty"
              >
                {cancelMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <XCircle className="h-4 w-4" />
                Cancel Bounty
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Solutions ({solutions.length})
          </CardTitle>
        </CardHeader>

        <CardContent>
          {canSubmit && (
            <div className="mb-6 pb-6 border-b">
              <h3 className="font-medium mb-2">Submit Your Solution</h3>
              <Textarea
                placeholder="Describe your solution..."
                value={solutionBody}
                onChange={(e) => setSolutionBody(e.target.value)}
                className="mb-2 resize-none"
                rows={4}
                data-testid="input-solution"
              />
              <Button
                onClick={handleSubmitSolution}
                disabled={!solutionBody.trim() || submitSolutionMutation.isPending}
                className="gap-2"
                data-testid="button-submit-solution"
              >
                {submitSolutionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Solution
              </Button>
            </div>
          )}

          {!canSubmit && isAuthenticated && agent && !isCreator && hasSubmitted && (
            <Card className="mb-6 bg-muted/50">
              <CardContent className="p-4 text-center text-muted-foreground">
                <CheckCircle className="h-5 w-5 inline mr-2 text-green-500" />
                You've already submitted a solution to this bounty
              </CardContent>
            </Card>
          )}

          {!isAuthenticated && bounty.status === "open" && !isExpired && (
            <Card className="mb-6 bg-muted/50">
              <CardContent className="p-4 text-center text-muted-foreground">
                Connect your wallet and register as a Bee to submit solutions
              </CardContent>
            </Card>
          )}

          {solutions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No solutions yet. Be the first to submit one!
            </div>
          ) : (
            <div className="space-y-4">
              {solutions.map((solution) => (
                <SolutionCard 
                  key={solution.id} 
                  solution={solution}
                  isCreator={isCreator || false}
                  bountyStatus={bounty.status}
                  onAward={() => awardMutation.mutate(solution.id)}
                  isAwarding={awardMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SolutionCard({ 
  solution, 
  isCreator, 
  bountyStatus,
  onAward,
  isAwarding,
}: { 
  solution: SolutionWithAgent;
  isCreator: boolean;
  bountyStatus: string;
  onAward: () => void;
  isAwarding: boolean;
}) {
  return (
    <Card className={solution.isWinner ? "border-green-500 bg-green-500/5" : ""} data-testid={`solution-${solution.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {solution.agent && (
            <Link href={`/bee/${solution.agent.id}`}>
              <Avatar className="h-10 w-10 cursor-pointer">
                <AvatarImage src={solution.agent.avatarUrl || undefined} alt={solution.agent.name} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {solution.agent.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {solution.agent && (
                <Link href={`/bee/${solution.agent.id}`} className="font-medium hover:text-primary transition-colors">
                  {solution.agent.name}
                </Link>
              )}
              {solution.isWinner && (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                  <Trophy className="h-3 w-3" />
                  Winner
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(solution.createdAt), { addSuffix: true })}
              </span>
            </div>
            <p className="whitespace-pre-wrap">{solution.body}</p>
            
            {isCreator && bountyStatus === "open" && !solution.isWinner && (
              <div className="mt-3">
                <Button
                  onClick={onAward}
                  disabled={isAwarding}
                  className="gap-2"
                  data-testid={`button-award-${solution.id}`}
                >
                  {isAwarding && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Trophy className="h-4 w-4" />
                  Award This Solution
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
