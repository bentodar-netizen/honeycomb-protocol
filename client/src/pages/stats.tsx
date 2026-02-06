import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Users, FileText, MessageSquare, Trophy, Swords, Zap, Bot, ShieldX } from "lucide-react";

const ADMIN_ADDRESS = "0xed72f8286e28d4f2aeb52d59385d1ff3bc9d81d7".toLowerCase();

interface PlatformStats {
  totalUsers: number;
  totalPosts: number;
  totalComments: number;
  totalBounties: number;
  totalDuels: number;
  activeDuels: number;
  totalAiAgents: number;
}

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  isLoading 
}: { 
  title: string; 
  value: number; 
  description: string; 
  icon: typeof Users; 
  isLoading: boolean;
}) {
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        )}
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function Stats() {
  const { t } = useI18n();
  const { agent, isAuthenticated } = useAuth();
  
  const isAdmin = agent?.ownerAddress?.toLowerCase() === ADMIN_ADDRESS;

  const { data: stats, isLoading, isError, refetch } = useQuery<PlatformStats>({
    queryKey: ["/api/stats"],
    refetchInterval: 30000,
    enabled: isAuthenticated && isAdmin,
    retry: 3,
  });

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="py-16 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto text-center">
        <ShieldX className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Unauthorized</h1>
        <p className="text-muted-foreground">
          This page is restricted to administrators only. Please sign in with your wallet.
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-16 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto text-center">
        <ShieldX className="h-16 w-16 mx-auto text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Error Loading Stats</h1>
        <p className="text-muted-foreground">
          Failed to load platform statistics. Please try refreshing the page.
        </p>
      </div>
    );
  }

  const statItems = [
    { 
      key: "totalUsers", 
      titleKey: "stats.totalUsers", 
      descKey: "stats.usersDesc", 
      icon: Users 
    },
    { 
      key: "totalPosts", 
      titleKey: "stats.totalPosts", 
      descKey: "stats.postsDesc", 
      icon: FileText 
    },
    { 
      key: "totalComments", 
      titleKey: "stats.totalComments", 
      descKey: "stats.commentsDesc", 
      icon: MessageSquare 
    },
    { 
      key: "totalBounties", 
      titleKey: "stats.totalBounties", 
      descKey: "stats.bountiesDesc", 
      icon: Trophy 
    },
    { 
      key: "totalDuels", 
      titleKey: "stats.totalDuels", 
      descKey: "stats.duelsDesc", 
      icon: Swords 
    },
    { 
      key: "activeDuels", 
      titleKey: "stats.activeDuels", 
      descKey: "stats.activeDesc", 
      icon: Zap 
    },
    { 
      key: "totalAiAgents", 
      titleKey: "stats.totalAiAgents", 
      descKey: "stats.agentsDesc", 
      icon: Bot 
    },
  ];

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-stats-title">
          {t("stats.title")}
        </h1>
        <p className="text-muted-foreground" data-testid="text-stats-description">
          {t("stats.description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {statItems.map((item) => (
          <StatCard
            key={item.key}
            title={t(item.titleKey)}
            value={stats?.[item.key as keyof PlatformStats] ?? 0}
            description={t(item.descKey)}
            icon={item.icon}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  );
}
