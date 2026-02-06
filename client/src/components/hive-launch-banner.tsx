import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Zap, Sparkles, Gift, ArrowRight, Clock } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";

interface HiveLaunchBannerProps {
  eventEndDate?: Date;
  onDismiss?: () => void;
}

export function HiveLaunchBanner({ eventEndDate, onDismiss }: HiveLaunchBannerProps) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const storedDismiss = localStorage.getItem("hiveLaunchDismissed");
    if (storedDismiss) {
      const dismissedAt = new Date(storedDismiss);
      const hoursSinceDismiss = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceDismiss < 24) {
        setDismissed(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!eventEndDate) return;

    const updateTimer = () => {
      const now = new Date();
      const diff = eventEndDate.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft({ hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [eventEndDate]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("hiveLaunchDismissed", new Date().toISOString());
    onDismiss?.();
  };

  if (dismissed) return null;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGgtMTJsLTYgMTAuNCA2IDEwLjRoMTJsNi0xMC40eiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHN0cm9rZS13aWR0aD0iMiIvPjwvZz48L3N2Zz4=')] opacity-30" />
      
      <div className="relative container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <div className="hidden sm:flex items-center gap-2">
              <div className="p-2 rounded-full bg-white/20 backdrop-blur-sm">
                <Zap className="h-5 w-5" />
              </div>
              <div className="hidden md:block">
                <Badge className="bg-white/20 text-white border-white/30 gap-1">
                  <Sparkles className="h-3 w-3" />
                  {t('hiveLaunch.liveNow')}
                </Badge>
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-lg">{t('hiveLaunch.title')}</span>
                <span className="text-white/90">{t('hiveLaunch.subtitle')}</span>
              </div>
            </div>

            {timeLeft && (
              <div className="hidden lg:flex items-center gap-2 bg-black/20 rounded-lg px-4 py-2">
                <Clock className="h-4 w-4" />
                <div className="flex flex-wrap items-center gap-1 font-mono text-sm">
                  <span className="bg-white/20 rounded px-2 py-1">{String(timeLeft.hours).padStart(2, '0')}</span>
                  <span>:</span>
                  <span className="bg-white/20 rounded px-2 py-1">{String(timeLeft.minutes).padStart(2, '0')}</span>
                  <span>:</span>
                  <span className="bg-white/20 rounded px-2 py-1">{String(timeLeft.seconds).padStart(2, '0')}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/rewards">
              <Button 
                size="sm" 
                className="bg-white text-amber-600 gap-2 font-semibold shadow-lg"
                data-testid="button-hive-launch-cta"
              >
                <Gift className="h-4 w-4" />
                <span className="hidden sm:inline">{t('hiveLaunch.cta')}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              size="icon"
              variant="ghost"
              className="text-white/80"
              onClick={handleDismiss}
              data-testid="button-dismiss-banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
