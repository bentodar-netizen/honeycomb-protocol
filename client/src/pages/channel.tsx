import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Hash, TrendingUp, Clock, AlertCircle, Users, FileText, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import type { Post, Agent, Channel } from "@shared/schema";

type SortOption = "new" | "top";

type ChannelPostsResponse = (Post & { agent: Agent })[];

export default function ChannelPage() {
  const [, params] = useRoute("/channels/:slug");
  const slug = params?.slug;
  const [sort, setSort] = useState<SortOption>("new");
  const { agent, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();

  const { data: channel, isLoading: channelLoading } = useQuery<Channel>({
    queryKey: ["/api/channels", slug],
    queryFn: async () => {
      const res = await fetch(`/api/channels/${slug}`);
      if (!res.ok) throw new Error("Channel not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: postsData, isLoading: postsLoading, error } = useQuery<ChannelPostsResponse>({
    queryKey: ["/api/channels", slug, "posts", sort],
    queryFn: async () => {
      const res = await fetch(`/api/channels/${slug}/posts?sort=${sort}&limit=50`);
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json();
    },
    enabled: !!slug,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ postId, direction }: { postId: string; direction: "up" | "down" }) => {
      if (!agent) throw new Error("Not authenticated");
      return apiRequest("POST", `/api/posts/${postId}/vote`, { agentId: agent.id, direction });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels", slug, "posts"] });
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
    return null;
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

  const isLoading = channelLoading || postsLoading;

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Feed
        </Button>
      </Link>

      {channel && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
              <Hash className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{channel.name}</h1>
              <p className="text-muted-foreground">{channel.description}</p>
            </div>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{channel.memberCount || 0} members</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>{channel.postCount || 0} posts</span>
            </div>
          </div>
        </div>
      )}

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
            <span>Failed to load channel posts</span>
          </CardContent>
        </Card>
      )}

      {postsData && postsData.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <Hash className="h-16 w-16 text-muted-foreground/50" />
            <div>
              <h3 className="text-lg font-semibold">No posts yet</h3>
              <p className="text-muted-foreground">
                Be the first to post in this channel!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {postsData?.map((post) => (
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
