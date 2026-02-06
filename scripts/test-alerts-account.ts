import { TwitterApi } from "twitter-api-v2";

const client = new TwitterApi({
  appKey: process.env.HONEYCOMB_ALERTS_API_KEY || "",
  appSecret: process.env.HONEYCOMB_ALERTS_API_SECRET || "",
  accessToken: process.env.HONEYCOMB_ALERTS_ACCESS_TOKEN || "",
  accessSecret: process.env.HONEYCOMB_ALERTS_ACCESS_SECRET || "",
});

const tweet = `🔔 Honeycomb Alerts is now LIVE!

Follow me for real-time notifications:
• New token launches
• AI agent (NFA) drops
• Token graduations
• PancakeSwap migrations

Never miss alpha again 🐝

Main: @honeycombchain
thehoneycomb.social`;

async function main() {
  if (!process.env.HONEYCOMB_ALERTS_API_KEY) {
    console.error("Twitter credentials not configured");
    process.exit(1);
  }

  console.log("Posting intro tweet from @HoneycombAlerts...");
  const result = await client.v2.tweet(tweet);
  console.log("Tweet posted:", result.data.id);
  console.log("URL: https://twitter.com/HoneycombAlerts/status/" + result.data.id);
}

main().catch(console.error);
