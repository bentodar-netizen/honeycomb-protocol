import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { CommentCard } from "@/components/comment-card";
import { ArrowUp, ArrowDown, ArrowLeft, Clock, MessageSquare, Loader2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { Post, Agent, Comment, Vote } from "@shared/schema";

interface PostDetailResponse {
  post: Post & { agent: Agent };
  comments: (Comment & { agent: Agent })[];
  userVote: Vote | null;
}

export default function PostDetail() {
  const [, params] = useRoute("/cell/:id");
  const postId = params?.id;
  const { agent, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [commentBody, setCommentBody] = useState("");

  const { data, isLoading, error } = useQuery<PostDetailResponse>({
    queryKey: ["/api/posts", postId],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${postId}`);
      if (!res.ok) throw new Error("Failed to fetch post");
      return res.json();
    },
    enabled: !!postId,
  });

  const voteMutation = useMutation({
    mutationFn: async (direction: "up" | "down") => {
      if (!agent) throw new Error("Not authenticated");
      return apiRequest("POST", `/api/posts/${postId}/vote`, { agentId: agent.id, direction });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts", postId] });
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

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      return apiRequest("POST", `/api/posts/${postId}/comments`, {
        agentId: agent.id,
        body: commentBody,
      });
    },
    onSuccess: () => {
      setCommentBody("");
      queryClient.invalidateQueries({ queryKey: ["/api/posts", postId] });
      toast({ title: "Comment added successfully" });
    },
    onError: (error) => {
      toast({
        title: "Failed to add comment",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleVote = (direction: "up" | "down") => {
    if (!isAuthenticated || !agent) {
      toast({
        title: "Authentication required",
        description: "Please connect your wallet and authenticate to vote",
        variant: "destructive",
      });
      return;
    }
    voteMutation.mutate(direction);
  };

  const handleComment = () => {
    if (!commentBody.trim()) return;
    if (!isAuthenticated || !agent) {
      toast({
        title: "Authentication required",
        description: "Please connect your wallet and authenticate to comment",
        variant: "destructive",
      });
      return;
    }
    commentMutation.mutate();
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
        <Link href="/">
          <Button variant="ghost" className="gap-2 mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Hive
          </Button>
        </Link>
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 p-6 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load post. It may have been deleted.</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { post, comments, userVote } = data;
  const score = post.upvotes - post.downvotes;

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <Link href="/">
        <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Hive
        </Button>
      </Link>

      <Card className="mb-6">
        <CardHeader className="flex flex-row gap-4">
          <div className="flex flex-col items-center gap-1 min-w-[50px]">
            <Button
              variant="ghost"
              size="icon"
              className={`h-10 w-10 ${userVote?.direction === "up" ? "text-primary bg-primary/10" : ""}`}
              onClick={() => handleVote("up")}
              disabled={voteMutation.isPending}
              data-testid="button-upvote"
            >
              <ArrowUp className="h-6 w-6" />
            </Button>
            <span className={`text-lg font-bold ${score > 0 ? "text-primary" : score < 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {score}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className={`h-10 w-10 ${userVote?.direction === "down" ? "text-destructive bg-destructive/10" : ""}`}
              onClick={() => handleVote("down")}
              disabled={voteMutation.isPending}
              data-testid="button-downvote"
            >
              <ArrowDown className="h-6 w-6" />
            </Button>
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-2" data-testid="text-post-title">{post.title}</h1>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              {post.agent && (
                <Link href={`/bee/${post.agent.id}`} className="flex items-center gap-2 hover:text-foreground transition-colors">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={post.agent.avatarUrl || undefined} alt={post.agent.name} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {post.agent.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{post.agent.name}</span>
                </Link>
              )}
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
              </div>
            </div>

            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="prose prose-neutral dark:prose-invert max-w-none whitespace-pre-wrap" data-testid="text-post-body">
            {post.body}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Comments ({comments.length})</h2>
          </div>
        </CardHeader>

        <CardContent>
          {isAuthenticated && agent ? (
            <div className="mb-6">
              <Textarea
                placeholder="Share your thoughts..."
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                className="mb-2 resize-none"
                rows={3}
                data-testid="input-comment"
              />
              <Button
                onClick={handleComment}
                disabled={!commentBody.trim() || commentMutation.isPending}
                className="gap-2"
                data-testid="button-submit-comment"
              >
                {commentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Comment
              </Button>
            </div>
          ) : (
            <Card className="mb-6 bg-muted/50">
              <CardContent className="p-4 text-center text-muted-foreground">
                Connect your wallet and authenticate to comment
              </CardContent>
            </Card>
          )}

          {comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No comments yet. Be the first to share your thoughts!
            </div>
          ) : (
            <div className="divide-y">
              {comments.map((comment) => (
                <CommentCard key={comment.id} comment={comment} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
