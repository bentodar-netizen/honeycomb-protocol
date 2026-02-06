import { Link } from "wouter";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUp, ArrowDown, MessageSquare, Clock, Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Post, Agent } from "@shared/schema";
import { useI18n } from "@/lib/i18n";

interface PostCardProps {
  post: Post & { agent?: Agent };
  onVote?: (direction: "up" | "down") => void;
  userVote?: "up" | "down" | null;
  isVoting?: boolean;
}

export function PostCard({ post, onVote, userVote, isVoting }: PostCardProps) {
  const { t, getDateLocale } = useI18n();
  const score = post.upvotes - post.downvotes;

  return (
    <Card className="hover-elevate transition-all duration-200" data-testid={`card-post-${post.id}`}>
      <CardHeader className="flex flex-row items-start gap-4 pb-2">
        <div className="flex flex-col items-center gap-1 min-w-[50px]">
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${userVote === "up" ? "text-primary bg-primary/10" : ""}`}
            onClick={() => onVote?.("up")}
            disabled={isVoting}
            data-testid={`button-upvote-${post.id}`}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
          <span className={`text-sm font-bold ${score > 0 ? "text-primary" : score < 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {score}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${userVote === "down" ? "text-destructive bg-destructive/10" : ""}`}
            onClick={() => onVote?.("down")}
            disabled={isVoting}
            data-testid={`button-downvote-${post.id}`}
          >
            <ArrowDown className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 min-w-0">
          <Link href={`/cell/${post.id}`} className="group" data-testid={`link-post-${post.id}`}>
            <h3 className="text-lg font-semibold group-hover:text-primary transition-colors line-clamp-2">
              {post.title}
            </h3>
          </Link>
          <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
            {post.body.slice(0, 200)}
            {post.body.length > 200 && "..."}
          </p>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-2">
          {post.agent && (
            <Link href={`/bee/${post.agent.id}`} className="flex items-center gap-2 hover:text-foreground transition-colors" data-testid={`link-author-${post.agent.id}`}>
              <Avatar className="h-6 w-6">
                <AvatarImage src={post.agent.avatarUrl || undefined} alt={post.agent.name} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {post.agent.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{post.agent.name}</span>
              {post.agent.isBot && (
                <Badge variant="outline" className="gap-1 text-xs py-0 h-5" data-testid={`badge-bot-${post.agent.id}`}>
                  <Bot className="h-3 w-3" />
                  Bot
                </Badge>
              )}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Link href={`/cell/${post.id}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <MessageSquare className="h-4 w-4" />
            <span>{post.commentCount}</span>
          </Link>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, ...getDateLocale() })}</span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
