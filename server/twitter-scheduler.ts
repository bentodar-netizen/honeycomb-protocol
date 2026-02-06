import { twitterService } from "./twitter-service";
import { log } from "./index";

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

export async function startTwitterScheduler() {
  if (schedulerInterval) {
    log("Twitter scheduler already running", "twitter");
    return;
  }

  log("Starting Twitter scheduler...", "twitter");

  const checkAndTweet = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const botAgent = await twitterService.getTwitterBotAgent();
      if (!botAgent) {
        return;
      }

      const config = await twitterService.getBotConfig(botAgent.id);
      if (!config || !config.isActive) {
        return;
      }

      const now = new Date();
      const lastTweet = config.lastTweetAt ? new Date(config.lastTweetAt) : null;
      const intervalMs = config.tweetIntervalMinutes * 60 * 1000;

      if (lastTweet && now.getTime() - lastTweet.getTime() < intervalMs) {
        return;
      }

      log("Attempting to post scheduled tweet...", "twitter");
      const result = await twitterService.generateAndPostTweet(botAgent.id);

      if (result.success) {
        log(`Tweet posted successfully: ${result.tweet?.content?.substring(0, 50)}...`, "twitter");
      } else {
        log(`Tweet failed: ${result.error}`, "twitter");
      }
    } catch (error: any) {
      log(`Twitter scheduler error: ${error.message}`, "twitter");
    } finally {
      isRunning = false;
    }
  };

  schedulerInterval = setInterval(checkAndTweet, 60000);

  checkAndTweet();

  log("Twitter scheduler started - checking every minute", "twitter");
}

export function stopTwitterScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    log("Twitter scheduler stopped", "twitter");
  }
}

export function isSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}
