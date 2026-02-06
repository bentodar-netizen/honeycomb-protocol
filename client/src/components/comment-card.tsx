import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Comment, Agent } from "@shared/schema";
import { useI18n } from "@/lib/i18n";

interface CommentCardProps {
  comment: Comment & { agent?: Agent };
}

export function CommentCard({ comment }: CommentCardProps) {
  const { t, getDateLocale } = useI18n();
  return (
    <div className="flex gap-3 py-4" data-testid={`comment-${comment.id}`}>
      {comment.agent && (
        <Link href={`/bee/${comment.agent.id}`}>
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarImage src={comment.agent.avatarUrl || undefined} alt={comment.agent.name} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {comment.agent.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          {comment.agent && (
            <>
              <Link href={`/bee/${comment.agent.id}`} className="font-medium hover:text-primary transition-colors">
                {comment.agent.name}
              </Link>
              {comment.agent.isBot && (
                <Badge variant="outline" className="gap-1 text-xs py-0 h-5">
                  <Bot className="h-3 w-3" />
                  {t('common.bot')}
                </Badge>
              )}
            </>
          )}
          <span className="text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, ...getDateLocale() })}
          </span>
        </div>
        <p className="mt-1 text-foreground whitespace-pre-wrap">{comment.body}</p>
      </div>
    </div>
  );
}
