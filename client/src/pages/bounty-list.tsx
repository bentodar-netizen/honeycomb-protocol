import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Coins, Plus, Clock, Users, Hexagon, AlertCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import type { Bounty, Agent } from "@shared/schema";

interface BountyWithAgent extends Bounty {
  agent?: Agent;
  isExpired?: boolean;
}

interface BountiesResponse {
  bounties: BountyWithAgent[];
}

export default function BountyList() {
  const [status, setStatus] = useState<"open" | "awarded" | "expired">("open");
  const { isAuthenticated, agent } = useAuth();
  const { t } = useI18n();

  const { data, isLoading, error } = useQuery<BountiesResponse>({
    queryKey: ["/api/bounties", status],
    queryFn: async () => {
      const res = await fetch(`/api/bounties?status=${status}`);
      if (!res.ok) throw new Error("Failed to fetch bounties");
      return res.json();
    },
  });

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Coins className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">{t('bounties.title')}</h1>
        </div>
        {isAuthenticated && agent && (
          <Link href="/honey/new">
            <Button className="gap-2" data-testid="button-create-bounty">
              <Plus className="h-4 w-4" />
              {t('bounties.createBounty')}
            </Button>
          </Link>
        )}
      </div>

      <p className="text-muted-foreground mb-6">
        {t('bounties.description')}
      </p>

      <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)} className="mb-6">
        <TabsList>
          <TabsTrigger value="open" data-testid="tab-open">{t('bounties.open')}</TabsTrigger>
          <TabsTrigger value="awarded" data-testid="tab-awarded">{t('bounties.completed')}</TabsTrigger>
          <TabsTrigger value="expired" data-testid="tab-expired">{t('bounties.expired')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 p-6 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{t('bounties.loadError')}</span>
          </CardContent>
        </Card>
      )}

      {data && data.bounties.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <Coins className="h-16 w-16 text-muted-foreground/50" />
            <div>
              <h3 className="text-lg font-semibold">{t('bounties.noBounties')}</h3>
              <p className="text-muted-foreground">
                {status === "open" 
                  ? t('bounties.beFirst')
                  : t('bounties.noBountiesStatus')}
              </p>
            </div>
            {status === "open" && isAuthenticated && agent && (
              <Link href="/honey/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('bounties.createBounty')}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {data && data.bounties.length > 0 && (
        <div className="space-y-4">
          {data.bounties.map((bounty) => (
            <BountyCard key={bounty.id} bounty={bounty} />
          ))}
        </div>
      )}
    </div>
  );
}

function BountyCard({ bounty }: { bounty: BountyWithAgent }) {
  const { t, getDateLocale } = useI18n();
  const isExpired = bounty.isExpired || new Date(bounty.deadline) < new Date();
  const statusColor = 
    bounty.status === "awarded" ? "bg-green-500/10 text-green-600 border-green-500/20" :
    bounty.status === "cancelled" ? "bg-red-500/10 text-red-600 border-red-500/20" :
    isExpired ? "bg-orange-500/10 text-orange-600 border-orange-500/20" :
    "bg-primary/10 text-primary border-primary/20";

  return (
    <Link href={`/honey/${bounty.id}`}>
      <Card className="hover-elevate transition-all duration-200 cursor-pointer" data-testid={`card-bounty-${bounty.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={statusColor}>
                  {bounty.status === "awarded" ? t('bounties.completed') : 
                   bounty.status === "cancelled" ? t('bounties.cancelled') :
                   isExpired ? t('bounties.expired') : t('bounties.open')}
                </Badge>
                <Badge variant="secondary" className="font-mono">
                  {bounty.rewardDisplay}
                </Badge>
              </div>

              <h3 className="text-lg font-semibold mb-1 line-clamp-1">
                {bounty.title}
              </h3>

              <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                {bounty.body.slice(0, 150)}
                {bounty.body.length > 150 && "..."}
              </p>

              {bounty.tags && bounty.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {bounty.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {bounty.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{bounty.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {bounty.agent && (
                  <div className="flex items-center gap-1">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={bounty.agent.avatarUrl || undefined} alt={bounty.agent.name} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {bounty.agent.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{bounty.agent.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{bounty.solutionCount} solution{bounty.solutionCount !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>
                    {isExpired || bounty.status !== "open"
                      ? format(new Date(bounty.deadline), "MMM d, yyyy")
                      : `${t('time.due')} ${formatDistanceToNow(new Date(bounty.deadline), { addSuffix: true, ...getDateLocale() })}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
