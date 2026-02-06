import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Twitter, Bot, Settings, Send, RefreshCw, CheckCircle, XCircle, Clock, Zap, MessageSquare, Users } from "lucide-react";
import { SiX } from "react-icons/si";

interface TwitterStatus {
  twitterApiConfigured: boolean;
  botAgent: { id: string; name: string } | null;
  config: {
    isActive: boolean;
    tweetIntervalMinutes: number;
    dailyTweetLimit: number;
    todayTweetCount: number;
    lastTweetAt: string | null;
    personality: string;
    tweetTopics: string[];
  } | null;
  recentTweets: Array<{
    id: string;
    content: string;
    status: string;
    tweetId: string | null;
    postedAt: string | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
}

interface TwitterConfig {
  agentId: string;
  agentName: string;
  isActive: boolean;
  tweetIntervalMinutes: number;
  dailyTweetLimit: number;
  todayTweetCount: number;
  lastTweetAt: string | null;
  systemPrompt: string;
  personality: string;
  tweetTopics: string[];
}

interface OutreachResult {
  success: boolean;
  targetUser: string;
  targetTweet: string;
  reply: string;
  replyId?: string;
  error?: string;
}

export default function TwitterAdmin() {
  const { toast } = useToast();
  const [generatedTweet, setGeneratedTweet] = useState("");
  const [manualTweet, setManualTweet] = useState("");
  const [editedPrompt, setEditedPrompt] = useState("");
  const [outreachUsername, setOutreachUsername] = useState("");
  const [outreachResult, setOutreachResult] = useState<OutreachResult | null>(null);

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<TwitterStatus>({
    queryKey: ["/api/twitter/status"],
  });

  const { data: config, isLoading: configLoading, refetch: refetchConfig } = useQuery<TwitterConfig>({
    queryKey: ["/api/twitter/config"],
    enabled: !!status?.botAgent,
  });

  const setupMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/twitter/setup"),
    onSuccess: () => {
      toast({ title: "Twitter bot set up successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/twitter/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/twitter/config"] });
    },
    onError: (error: any) => {
      toast({ title: "Setup failed", description: error.message, variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/twitter/activate"),
    onSuccess: () => {
      toast({ title: "Twitter bot activated" });
      refetchStatus();
      refetchConfig();
    },
    onError: (error: any) => {
      toast({ title: "Activation failed", description: error.message, variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/twitter/deactivate"),
    onSuccess: () => {
      toast({ title: "Twitter bot deactivated" });
      refetchStatus();
      refetchConfig();
    },
    onError: (error: any) => {
      toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: (params: { topic?: string; style?: string }) =>
      apiRequest("POST", "/api/twitter/generate", params),
    onSuccess: (data: any) => {
      setGeneratedTweet(data.content);
      toast({ title: "Tweet generated", description: `${data.characterCount} characters` });
    },
    onError: (error: any) => {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    },
  });

  const postMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/twitter/post"),
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Tweet posted successfully" });
      } else {
        toast({ title: "Tweet saved but not posted", description: data.error, variant: "destructive" });
      }
      refetchStatus();
    },
    onError: (error: any) => {
      toast({ title: "Posting failed", description: error.message, variant: "destructive" });
    },
  });

  const postManualMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", "/api/twitter/post-manual", { content }),
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Tweet posted successfully" });
        setManualTweet("");
        setGeneratedTweet("");
      } else {
        toast({ title: "Tweet saved but not posted", description: data.error, variant: "destructive" });
      }
      refetchStatus();
    },
    onError: (error: any) => {
      toast({ title: "Posting failed", description: error.message, variant: "destructive" });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: (updates: Partial<TwitterConfig>) =>
      apiRequest("PATCH", "/api/twitter/config", updates),
    onSuccess: () => {
      toast({ title: "Configuration updated" });
      refetchConfig();
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const outreachMutation = useMutation({
    mutationFn: async (username: string): Promise<OutreachResult> =>
      apiRequest("POST", "/api/twitter/outreach", { username }) as Promise<OutreachResult>,
    onSuccess: (data: OutreachResult) => {
      setOutreachResult(data);
      if (data.success) {
        toast({ title: "Outreach reply posted!", description: `Replied to @${data.targetUser}` });
        setOutreachUsername("");
      } else {
        toast({ title: "Outreach failed", description: data.error, variant: "destructive" });
      }
      refetchStatus();
    },
    onError: (error: any) => {
      toast({ title: "Outreach failed", description: error.message, variant: "destructive" });
    },
  });

  const moltbookMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/twitter/engage-moltbook") as Promise<{ success: boolean; engaged: number; error?: string }>,
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Predict Engagement Complete", description: `Engaged with ${data.engaged} tweets` });
      } else {
        toast({ title: "Engagement failed", description: data.error, variant: "destructive" });
      }
      refetchStatus();
    },
    onError: (error: any) => {
      toast({ title: "Engagement failed", description: error.message, variant: "destructive" });
    },
  });

  const launchpadMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/twitter/engage-launchpad") as Promise<{ success: boolean; engaged: number; error?: string }>,
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Launchpad Engagement Complete", description: `Engaged with ${data.engaged} tweets` });
      } else {
        toast({ title: "Engagement failed", description: data.error, variant: "destructive" });
      }
      refetchStatus();
    },
    onError: (error: any) => {
      toast({ title: "Engagement failed", description: error.message, variant: "destructive" });
    },
  });

  if (statusLoading) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto flex justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!status?.botAgent) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 bg-amber-100 dark:bg-amber-900/30 rounded-full w-fit">
              <SiX className="h-12 w-12 text-foreground" />
            </div>
            <CardTitle className="text-2xl">Twitter Automation</CardTitle>
            <CardDescription>
              Set up an AI-powered Twitter bot to automatically post about Honeycomb
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600"
              data-testid="button-setup-twitter"
            >
              {setupMutation.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Bot className="mr-2 h-4 w-4" />
              )}
              Set Up Twitter Bot
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isActive = status.config?.isActive || config?.isActive;

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <SiX className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Twitter Automation</h1>
            <p className="text-sm text-muted-foreground">Manage your Honeycomb Twitter bot</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={status.twitterApiConfigured ? "default" : "destructive"}>
            {status.twitterApiConfigured ? "API Connected" : "API Not Configured"}
          </Badge>
          <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-green-500" : ""}>
            {isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Generate & Post Tweet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={() => generateMutation.mutate({})}
                  disabled={generateMutation.isPending}
                  variant="outline"
                  data-testid="button-generate-tweet"
                >
                  {generateMutation.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-4 w-4" />
                  )}
                  Generate Tweet
                </Button>
                <Button
                  onClick={() => postMutation.mutate()}
                  disabled={postMutation.isPending || !isActive}
                  className="bg-amber-500 hover:bg-amber-600"
                  data-testid="button-auto-post"
                >
                  {postMutation.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Generate & Post
                </Button>
              </div>

              {generatedTweet && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm mb-2">Generated Tweet ({generatedTweet.length}/280):</p>
                  <p className="font-medium">{generatedTweet}</p>
                  <Button
                    onClick={() => postManualMutation.mutate(generatedTweet)}
                    disabled={postManualMutation.isPending}
                    className="mt-3 bg-amber-500 hover:bg-amber-600"
                    size="sm"
                    data-testid="button-post-generated"
                  >
                    Post This Tweet
                  </Button>
                </div>
              )}

              <div className="border-t pt-4">
                <Label htmlFor="manual-tweet">Manual Tweet</Label>
                <Textarea
                  id="manual-tweet"
                  value={manualTweet}
                  onChange={(e) => setManualTweet(e.target.value.slice(0, 280))}
                  placeholder="Write a custom tweet..."
                  className="mt-2"
                  data-testid="input-manual-tweet"
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-muted-foreground">{manualTweet.length}/280</span>
                  <Button
                    onClick={() => postManualMutation.mutate(manualTweet)}
                    disabled={postManualMutation.isPending || !manualTweet.trim()}
                    size="sm"
                    data-testid="button-post-manual"
                  >
                    Post Manual Tweet
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Tweets</CardTitle>
            </CardHeader>
            <CardContent>
              {status.recentTweets.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No tweets yet</p>
              ) : (
                <div className="space-y-3">
                  {status.recentTweets.map((tweet) => (
                    <div key={tweet.id} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm flex-1">{tweet.content}</p>
                        <Badge
                          variant={
                            tweet.status === "posted"
                              ? "default"
                              : tweet.status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                          className="shrink-0"
                        >
                          {tweet.status === "posted" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {tweet.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                          {tweet.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                          {tweet.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{new Date(tweet.createdAt).toLocaleString()}</span>
                        {tweet.errorMessage && (
                          <span className="text-destructive">Error: {tweet.errorMessage}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Bot Outreach
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Reply to other bots and invite them to Honeycomb
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="@username"
                  value={outreachUsername}
                  onChange={(e) => setOutreachUsername(e.target.value)}
                  data-testid="input-outreach-username"
                />
                <Button
                  onClick={() => outreachMutation.mutate(outreachUsername)}
                  disabled={outreachMutation.isPending || !outreachUsername.trim()}
                  className="shrink-0"
                  data-testid="button-outreach-send"
                >
                  {outreachMutation.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="mr-2 h-4 w-4" />
                  )}
                  Send Outreach
                </Button>
              </div>

              {outreachResult && (
                <div className={`p-4 rounded-lg ${outreachResult.success ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {outreachResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium">
                      {outreachResult.success ? "Reply Sent!" : "Failed"}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p><strong>Target:</strong> @{outreachResult.targetUser}</p>
                    <p><strong>Their Tweet:</strong> {outreachResult.targetTweet?.slice(0, 100)}...</p>
                    <p><strong>Our Reply:</strong> {outreachResult.reply}</p>
                    {outreachResult.error && (
                      <p className="text-red-600"><strong>Error:</strong> {outreachResult.error}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Engage "moltbook" or "prediction market" mentions
                  </p>
                  <Button
                    onClick={() => moltbookMutation.mutate()}
                    disabled={moltbookMutation.isPending}
                    className="w-full bg-amber-500 hover:bg-amber-600"
                    data-testid="button-engage-moltbook"
                  >
                    {moltbookMutation.isPending ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Users className="mr-2 h-4 w-4" />
                    )}
                    Engage Predict Mentions
                  </Button>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Engage "token launch" or "clawnch" mentions
                  </p>
                  <Button
                    onClick={() => launchpadMutation.mutate()}
                    disabled={launchpadMutation.isPending}
                    className="w-full bg-primary hover:bg-primary/90"
                    data-testid="button-engage-launchpad"
                  >
                    {launchpadMutation.isPending ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Users className="mr-2 h-4 w-4" />
                    )}
                    Engage Launchpad Mentions
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Bot Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="bot-active">Bot Active</Label>
                <Switch
                  id="bot-active"
                  checked={isActive}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      activateMutation.mutate();
                    } else {
                      deactivateMutation.mutate();
                    }
                  }}
                  data-testid="switch-bot-active"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interval">Tweet Interval (minutes)</Label>
                <Input
                  id="interval"
                  type="number"
                  min={15}
                  max={1440}
                  value={config?.tweetIntervalMinutes || 60}
                  onChange={(e) =>
                    updateConfigMutation.mutate({ tweetIntervalMinutes: parseInt(e.target.value) })
                  }
                  data-testid="input-interval"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="daily-limit">Daily Tweet Limit</Label>
                <Input
                  id="daily-limit"
                  type="number"
                  min={1}
                  max={100}
                  value={config?.dailyTweetLimit || 24}
                  onChange={(e) =>
                    updateConfigMutation.mutate({ dailyTweetLimit: parseInt(e.target.value) })
                  }
                  data-testid="input-daily-limit"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="personality">Personality</Label>
                <Select
                  value={config?.personality || "professional"}
                  onValueChange={(value) => updateConfigMutation.mutate({ personality: value })}
                >
                  <SelectTrigger data-testid="select-personality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="hype">Hype</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Tweets today: <strong>{config?.todayTweetCount || 0}</strong> /{" "}
                  {config?.dailyTweetLimit || 24}
                </p>
                {config?.lastTweetAt && (
                  <p className="text-sm text-muted-foreground">
                    Last tweet: {new Date(config.lastTweetAt).toLocaleString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={editedPrompt || config?.systemPrompt || ""}
                onChange={(e) => setEditedPrompt(e.target.value)}
                rows={8}
                className="text-xs"
                data-testid="textarea-system-prompt"
              />
              <Button
                onClick={() => {
                  if (editedPrompt) {
                    updateConfigMutation.mutate({ systemPrompt: editedPrompt });
                    setEditedPrompt("");
                  }
                }}
                disabled={!editedPrompt || updateConfigMutation.isPending}
                size="sm"
                className="w-full"
                data-testid="button-save-prompt"
              >
                Save System Prompt
              </Button>
            </CardContent>
          </Card>

          {!status.twitterApiConfigured && (
            <Card className="border-amber-500">
              <CardHeader>
                <CardTitle className="text-amber-600">API Setup Required</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>To post tweets, add these environment variables:</p>
                <ul className="list-disc list-inside text-muted-foreground">
                  <li>TWITTER_API_KEY</li>
                  <li>TWITTER_API_SECRET</li>
                  <li>TWITTER_ACCESS_TOKEN</li>
                  <li>TWITTER_ACCESS_SECRET</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  Get these from the Twitter Developer Portal
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
