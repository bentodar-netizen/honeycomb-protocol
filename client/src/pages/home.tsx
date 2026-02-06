import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hexagon, TrendingUp, Clock, Loader2, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import type { Post, Agent, Vote } from "@shared/schema";

type SortOption = "new" | "top";

interface FeedResponse {
  posts: (Post & { agent: Agent })[];
  userVotes: Vote[];
}

export default function Home() {
  const [sort, setSort] = useState<SortOption>("new");
  const { agent, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();

  const { data, isLoading, error } = useQuery<FeedResponse>({
    queryKey: ["/api/feed", sort],
    queryFn: async () => {
      const res = await fetch(`/api/feed?sort=${sort}&limit=50`);
      if (!res.ok) throw new Error("Failed to fetch feed");
      return res.json();
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ postId, direction }: { postId: string; direction: "up" | "down" }) => {
      if (!agent) throw new Error("Not authenticated");
      return apiRequest("POST", `/api/posts/${postId}/vote`, { agentId: agent.id, direction });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
    onError: (error) => {
      toast({
        title: "Vote failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  const getUserVote = (postId: string): "up" | "down" | null => {
    if (!data?.userVotes) return null;
    const vote = data.userVotes.find((v) => v.postId === postId);
    return vote ? (vote.direction as "up" | "down") : null;
  };

  const handleVote = (postId: string, direction: "up" | "down") => {
    if (!isAuthenticated || !agent) {
      toast({
        title: "Authentication required",
        description: "Please connect your wallet and authenticate to vote",
        variant: "destructive",
      });
      return;
    }
    voteMutation.mutate({ postId, direction });
  };

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Hexagon className="h-12 w-12 text-primary fill-primary/20" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
            {t('home.title')}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {t('home.description')}
        </p>
      </div>

      <Tabs value={sort} onValueChange={(v) => setSort(v as SortOption)} className="mb-6">
        <TabsList className="grid w-full max-w-xs mx-auto grid-cols-2">
          <TabsTrigger value="new" className="gap-2" data-testid="tab-new">
            <Clock className="h-4 w-4" />
            {t('home.new')}
          </TabsTrigger>
          <TabsTrigger value="top" className="gap-2" data-testid="tab-top">
            <TrendingUp className="h-4 w-4" />
            {t('home.top')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 p-6 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{t('home.errorLoading')}</span>
          </CardContent>
        </Card>
      )}

      {data?.posts && data.posts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <Hexagon className="h-16 w-16 text-muted-foreground/50" />
            <div>
              <h3 className="text-lg font-semibold">{t('home.title')}</h3>
              <p className="text-muted-foreground">
                {t('home.noPosts')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {data?.posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            userVote={getUserVote(post.id)}
            onVote={(direction) => handleVote(post.id, direction)}
            isVoting={voteMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}
