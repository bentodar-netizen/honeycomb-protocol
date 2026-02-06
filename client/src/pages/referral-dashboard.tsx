import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  Users, Link, Copy, Share2, Trophy, Crown, Award, 
  TrendingUp, Star, ChevronRight, Check, Hexagon, Coins
} from "lucide-react";
import { SiX, SiTelegram } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";

interface Referral {
  id: string;
  referrerAgentId: string;
  referralCode: string;
  referralCount: number;
  tier: string;
  totalRewardsEarned: string;
  createdAt: string;
}

interface ReferralConversion {
  id: string;
  referralId: string;
  referredAgentId: string;
  rewardAmount: string;
  createdAt: string;
}

interface ReferralStats extends Referral {
  conversions: ReferralConversion[];
}

interface EarlyAdopterStatus {
  isEarlyAdopter: boolean;
  badgeNumber?: number;
  rewardMultiplier?: string;
  totalEarlyAdopters: number;
  maxEarlyAdopters: number;
}

interface UserPoints {
  id: string;
  agentId: string;
  totalPoints: number;
  lifetimePoints: number;
  dailyEarned: number;
  lastEarnedAt: string | null;
}

interface LeaderboardEntry {
  id: string;
  referrerAgentId: string;
  referralCode: string;
  referralCount: number;
  tier: string;
  agent: { id: string; name: string; avatarUrl: string | null } | null;
}

interface PointsLeaderboardEntry {
  rank: number;
  agentId: string;
  name: string;
  avatarUrl: string | null;
  totalPoints: number;
  lifetimePoints: number;
}

const TIER_CONFIG: Record<string, { labelKey: string; color: string; icon: typeof Crown; nextTierKey?: string; nextRequirement?: number }> = {
  newcomer: { labelKey: "rewards.tierNewcomer", color: "bg-muted text-muted-foreground", icon: Users, nextTierKey: "rewards.tierBronze", nextRequirement: 5 },
  bronze: { labelKey: "rewards.tierBronze", color: "bg-amber-700/20 text-amber-600", icon: Award, nextTierKey: "rewards.tierSilver", nextRequirement: 25 },
  silver: { labelKey: "rewards.tierSilver", color: "bg-slate-400/20 text-slate-400", icon: Award, nextTierKey: "rewards.tierGold", nextRequirement: 100 },
  gold: { labelKey: "rewards.tierGold", color: "bg-yellow-500/20 text-yellow-500", icon: Trophy, nextTierKey: "rewards.tierQueen", nextRequirement: 500 },
  queen: { labelKey: "rewards.tierQueen", color: "bg-purple-500/20 text-purple-400", icon: Crown },
};

function getTierProgress(tier: string, count: number): number {
  const config = TIER_CONFIG[tier];
  if (!config?.nextRequirement) return 100;
  const prev = tier === "newcomer" ? 0 : tier === "bronze" ? 5 : tier === "silver" ? 25 : 100;
  return Math.min(100, ((count - prev) / (config.nextRequirement - prev)) * 100);
}

export default function ReferralDashboard() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const { data: referralLink, isLoading: linkLoading } = useQuery<Referral>({
    queryKey: ["/api/referrals/my-link"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ReferralStats>({
    queryKey: ["/api/referrals/stats"],
  });

  const { data: earlyAdopter, isLoading: eaLoading } = useQuery<EarlyAdopterStatus>({
    queryKey: ["/api/early-adopter"],
  });

  const { data: leaderboardData, isLoading: lbLoading } = useQuery<{ leaderboard: LeaderboardEntry[] }>({
    queryKey: ["/api/leaderboards/referrers"],
  });

  const { data: pointsData } = useQuery<{ points: UserPoints }>({
    queryKey: ["/api/points/my"],
  });

  const { data: pointsLeaderboard, isLoading: plbLoading } = useQuery<{ leaderboard: PointsLeaderboardEntry[] }>({
    queryKey: ["/api/points/leaderboard"],
  });

  const shortCode = referralLink?.referralCode?.replace("BEE", "") || "";
  const referralUrl = referralLink ? `${window.location.origin}/r/${shortCode}` : "";
  const tierConfig = TIER_CONFIG[stats?.tier || "newcomer"];
  const TierIcon = tierConfig?.icon || Users;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast({ title: t('rewards.copied'), description: t('rewards.copiedDesc') });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareReferral = () => {
    if (navigator.share) {
      navigator.share({
        title: "Join Honeycomb",
        text: t('rewards.shareToInvite'),
        url: referralUrl,
      });
    } else {
      copyToClipboard();
    }
  };

  const shareToTwitter = () => {
    const text = encodeURIComponent(t('rewards.shareTextTwitter'));
    const url = encodeURIComponent(referralUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  const shareToTelegram = () => {
    const text = encodeURIComponent(t('rewards.shareTextTelegram'));
    const url = encodeURIComponent(referralUrl);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, "_blank");
  };

  const isLoading = linkLoading || statsLoading || eaLoading;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{t('rewards.title')}</h1>
            <p className="text-muted-foreground">{t('rewards.subtitle')}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card data-testid="card-total-points">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('rewards.totalPoints')}</p>
                      <p className="text-3xl font-bold text-amber-500">{pointsData?.points?.totalPoints?.toLocaleString() || 0}</p>
                    </div>
                    <div className="p-3 rounded-full bg-amber-500/10">
                      <Coins className="h-6 w-6 text-amber-500" />
                    </div>
                  </div>
                  {earlyAdopter?.isEarlyAdopter && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('rewards.multiplierActive')}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-total-referrals">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('rewards.totalReferrals')}</p>
                      <p className="text-3xl font-bold">{stats?.referralCount || 0}</p>
                    </div>
                    <div className="p-3 rounded-full bg-primary/10">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('rewards.yourTier')}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={tierConfig?.color}>
                          <TierIcon className="h-3 w-3 mr-1" />
                          {t(tierConfig?.labelKey || 'rewards.tierNewcomer')}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-3 rounded-full bg-primary/10">
                      <Trophy className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  {tierConfig?.nextRequirement && (
                    <div className="mt-3">
                      <Progress value={getTierProgress(stats?.tier || "newcomer", stats?.referralCount || 0)} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats?.referralCount || 0} / {tierConfig.nextRequirement} {t('rewards.for')} {t(tierConfig.nextTierKey || '')}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('rewards.earlyAdopter')}</p>
                      {earlyAdopter?.isEarlyAdopter ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                            <Star className="h-3 w-3 mr-1" />
                            #{earlyAdopter.badgeNumber}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {earlyAdopter.rewardMultiplier}{t('rewards.xRewards')}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1">
                          {earlyAdopter?.totalEarlyAdopters || 0} / {earlyAdopter?.maxEarlyAdopters || 10000} {t('rewards.spotsTaken')}
                        </p>
                      )}
                    </div>
                    <div className="p-3 rounded-full bg-amber-500/10">
                      <Star className="h-6 w-6 text-amber-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link className="h-5 w-5 text-primary" />
                  {t('rewards.yourReferralLink')}
                </CardTitle>
                <CardDescription>{t('rewards.shareToInvite')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input 
                    value={referralUrl} 
                    readOnly 
                    className="font-mono text-sm" 
                    data-testid="input-referral-link"
                  />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={copyToClipboard}
                    data-testid="button-copy-referral"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button 
                    onClick={shareToTwitter} 
                    className="flex-1 bg-black text-white"
                    data-testid="button-share-twitter"
                  >
                    <SiX className="h-4 w-4 mr-2" />
                    {t('rewards.shareTwitter')}
                  </Button>
                  <Button 
                    onClick={shareToTelegram} 
                    className="flex-1 bg-[#0088cc] text-white"
                    data-testid="button-share-telegram"
                  >
                    <SiTelegram className="h-4 w-4 mr-2" />
                    {t('rewards.shareTelegram')}
                  </Button>
                  <Button variant="outline" onClick={shareReferral} data-testid="button-share-referral">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {t('rewards.code')}: <code className="bg-muted px-1 py-0.5 rounded">{referralLink?.referralCode}</code>
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    {t('rewards.tierBenefits')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(TIER_CONFIG).map(([key, config]) => {
                      const Icon = config.icon;
                      const isCurrentTier = key === (stats?.tier || "newcomer");
                      return (
                        <div 
                          key={key} 
                          className={`flex items-center justify-between p-3 rounded-lg ${isCurrentTier ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${config.color}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium">{t(config.labelKey)}</p>
                              <p className="text-xs text-muted-foreground">
                                {config.nextRequirement ? `${config.nextRequirement - (key === "newcomer" ? 0 : key === "bronze" ? 5 : key === "silver" ? 25 : 100)} ${t('rewards.moreReferrals')}` : t('rewards.topTier')}
                              </p>
                            </div>
                          </div>
                          {isCurrentTier && (
                            <Badge variant="outline" className="border-primary text-primary">{t('rewards.current')}</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    {t('rewards.topReferrers')}
                  </CardTitle>
                  <CardDescription>{t('rewards.topReferrersDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {lbLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {leaderboardData?.leaderboard?.slice(0, 5).map((entry, index) => {
                        const tierConf = TIER_CONFIG[entry.tier];
                        return (
                          <div key={entry.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-yellow-500 text-black' : index === 1 ? 'bg-slate-400 text-black' : index === 2 ? 'bg-amber-700 text-white' : 'bg-muted text-muted-foreground'}`}>
                                {index + 1}
                              </div>
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={entry.agent?.avatarUrl || undefined} />
                                <AvatarFallback>{entry.agent?.name?.[0] || "?"}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{entry.agent?.name || "Unknown"}</p>
                                <Badge variant="outline" className={`text-xs ${tierConf?.color}`}>
                                  {t(tierConf?.labelKey || 'rewards.tierNewcomer')}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{entry.referralCount}</p>
                              <p className="text-xs text-muted-foreground">{t('rewards.referrals')}</p>
                            </div>
                          </div>
                        );
                      })}
                      {(!leaderboardData?.leaderboard || leaderboardData.leaderboard.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">{t('rewards.noReferralsYet')}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5 text-amber-500" />
                    {t('rewards.topPointsEarners')}
                  </CardTitle>
                  <CardDescription>{t('rewards.topPointsEarnersDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {plbLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pointsLeaderboard?.leaderboard?.slice(0, 5).map((entry) => (
                        <div key={entry.agentId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${entry.rank === 1 ? 'bg-yellow-500 text-black' : entry.rank === 2 ? 'bg-slate-400 text-black' : entry.rank === 3 ? 'bg-amber-700 text-white' : 'bg-muted text-muted-foreground'}`}>
                              {entry.rank}
                            </div>
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={entry.avatarUrl || undefined} />
                              <AvatarFallback>{entry.name?.[0] || "?"}</AvatarFallback>
                            </Avatar>
                            <p className="font-medium text-sm">{entry.name || "Unknown Bee"}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-amber-500">{entry.totalPoints?.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{t('rewards.points')}</p>
                          </div>
                        </div>
                      ))}
                      {(!pointsLeaderboard?.leaderboard || pointsLeaderboard.leaderboard.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">{t('rewards.noPointsYet')}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {stats?.conversions && stats.conversions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    {t('rewards.recentReferrals')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.conversions.slice(0, 10).map((conv) => (
                      <div key={conv.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-green-500/10">
                            <Check className="h-4 w-4 text-green-500" />
                          </div>
                          <p className="text-sm">{t('rewards.newBeeJoined')}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(conv.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
