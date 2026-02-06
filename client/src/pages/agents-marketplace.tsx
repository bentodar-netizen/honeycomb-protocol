import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Zap, MessageSquare, Coins, Plus, TrendingUp, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface AiAgentProfile {
  id: string;
  agentId: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  capabilities: string[];
  systemPrompt: string;
  pricingModel: string;
  pricePerUnit: string;
  creatorAddress: string;
  isActive: boolean;
  totalInteractions: number;
  totalEarnings: string;
  createdAt: string;
}

function formatPrice(weiAmount: string): string {
  const bnb = parseFloat(weiAmount) / 1e18;
  if (bnb < 0.0001) {
    return `${(bnb * 1e6).toFixed(2)} μBNB`;
  }
  if (bnb < 0.01) {
    return `${(bnb * 1000).toFixed(3)} mBNB`;
  }
  return `${bnb.toFixed(4)} BNB`;
}

function getPricingLabel(model: string, t: (key: string) => string): string {
  switch (model) {
    case "per_message":
      return t('agents.perMessage');
    case "per_token":
      return t('agents.perToken');
    case "per_task":
      return t('agents.perTask');
    default:
      return model;
  }
}

function AgentCard({ agent }: { agent: AiAgentProfile }) {
  const { t } = useI18n();
  return (
    <Link href={`/agents/${agent.agentId}`}>
      <Card className="hover-elevate cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={agent.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{agent.name}</CardTitle>
              <CardDescription className="line-clamp-2 text-sm">
                {agent.bio || t('agents.defaultBio')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Coins className="h-4 w-4" />
              <span className="font-medium">{formatPrice(agent.pricePerUnit)}</span>
              <span className="text-xs text-muted-foreground">{getPricingLabel(agent.pricingModel, t)}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span>{agent.totalInteractions.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              <span>{formatPrice(agent.totalEarnings)} {t('agents.earned')}</span>
            </div>
          </div>

          {agent.capabilities && agent.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {agent.capabilities.slice(0, 3).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {agent.capabilities.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{agent.capabilities.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function AgentCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-5 w-24" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-12" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentsMarketplace() {
  const { t } = useI18n();

  const { data, isLoading } = useQuery<{ agents: AiAgentProfile[] }>({
    queryKey: ["/api/ai-agents"],
  });

  const agents = data?.agents || [];

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-amber-500" />
            {t('agents.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('agents.description')}
          </p>
        </div>
        <Link href="/create-agent">
          <Button data-testid="button-create-agent" className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            {t('agents.createAgent')}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Bot className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{agents.length}</p>
                <p className="text-sm text-muted-foreground">{t('agents.activeAgents')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {agents.reduce((sum, a) => sum + a.totalInteractions, 0).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">{t('agents.totalInteractions')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">99%</p>
                <p className="text-sm text-muted-foreground">{t('agents.creatorRevenue')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Bot className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t('agents.noAgents')}</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {t('agents.noAgentsDescription')}
            </p>
            <Link href="/create-agent">
              <Button data-testid="button-create-first-agent" className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                {t('agents.createAgent')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      <Card className="mt-8 bg-muted/50">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold mb-1">How It Works</h3>
              <p className="text-sm text-muted-foreground">
                Create AI agents, set your pricing, and earn 99% of all usage fees. Payments are handled on-chain via smart contracts.
              </p>
            </div>
            <Link href="/how-to">
              <Button variant="outline" data-testid="button-learn-more">
                Learn More
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
