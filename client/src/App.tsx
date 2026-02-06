import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "./lib/wagmi";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { I18nProvider } from "@/lib/i18n";
import { Header } from "@/components/header";
import { NetworkWarningBanner } from "@/components/network-switcher";
import { HiveLaunchBanner } from "@/components/hive-launch-banner";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import PostDetail from "@/pages/post-detail";
import BeeProfile from "@/pages/bee-profile";
import CreatePost from "@/pages/create-post";
import RegisterBee from "@/pages/register-bee";
import BountyList from "@/pages/bounty-list";
import CreateBounty from "@/pages/create-bounty";
import BountyDetail from "@/pages/bounty-detail";
import LaunchList from "@/pages/launch-list";
import LaunchCreate from "@/pages/launch-create";
import LaunchDetail from "@/pages/launch-detail";
import HowTo from "@/pages/how-to";
import CreateAgent from "@/pages/create-agent";
import AgentsMarketplace from "@/pages/agents-marketplace";
import AgentChat from "@/pages/agent-chat";
import Predict from "@/pages/predict";
import Stats from "@/pages/stats";
import Channel from "@/pages/channel";
import TwitterAdmin from "@/pages/twitter-admin";
import GmgnDocs from "@/pages/gmgn-docs";
import AgentDirectory from "@/pages/agent-directory";
import AgentProfile from "@/pages/agent-profile";
import AgentLeaderboard from "@/pages/agent-leaderboard";
import AgentTradingDashboard from "@/pages/agent-trading-dashboard";
import BeepayOverview from "@/pages/beepay-overview";
import BeepayPayments from "@/pages/beepay-payments";
import BeepayInvoices from "@/pages/beepay-invoices";
import BeepayEscrows from "@/pages/beepay-escrows";
import BeepayBudget from "@/pages/beepay-budget";
import NfaMarketplace from "@/pages/nfa-marketplace";
import NfaMint from "@/pages/nfa-mint";
import NfaDetail from "@/pages/nfa-detail";
import ERC8004Register from "@/pages/erc8004-register";
import ReferralDashboard from "@/pages/referral-dashboard";
import ReferralRedirect from "@/pages/referral-redirect";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/feed" component={Home} />
      <Route path="/cell/:id" component={PostDetail} />
      <Route path="/bee/:id" component={BeeProfile} />
      <Route path="/create" component={CreatePost} />
      <Route path="/register" component={RegisterBee} />
      <Route path="/honey" component={BountyList} />
      <Route path="/honey/new" component={CreateBounty} />
      <Route path="/honey/:id" component={BountyDetail} />
      <Route path="/launch" component={LaunchList} />
      <Route path="/launchpad">{() => <Redirect to="/launch" />}</Route>
      <Route path="/launch/new" component={LaunchCreate} />
      <Route path="/launch/:address" component={LaunchDetail} />
      <Route path="/how-to" component={HowTo} />
      <Route path="/create-agent" component={CreateAgent} />
      <Route path="/agents" component={AgentsMarketplace} />
      <Route path="/agents/:agentId" component={AgentChat} />
      <Route path="/predict" component={Predict} />
      <Route path="/stats" component={Stats} />
      <Route path="/channels/:slug" component={Channel} />
      <Route path="/admin/twitter" component={TwitterAdmin} />
      <Route path="/docs/gmgn" component={GmgnDocs} />
      <Route path="/hatchery" component={AgentDirectory} />
      <Route path="/hatchery/leaderboard" component={AgentLeaderboard} />
      <Route path="/hatchery/trading" component={AgentTradingDashboard} />
      <Route path="/hatchery/:id" component={AgentProfile} />
      <Route path="/beepay" component={BeepayOverview} />
      <Route path="/beepay/payments" component={BeepayPayments} />
      <Route path="/beepay/invoices" component={BeepayInvoices} />
      <Route path="/beepay/escrows" component={BeepayEscrows} />
      <Route path="/beepay/budget" component={BeepayBudget} />
      <Route path="/nfa" component={NfaMarketplace} />
      <Route path="/nfa/mint" component={NfaMint} />
      <Route path="/nfa/:id" component={NfaDetail} />
      <Route path="/erc8004" component={ERC8004Register} />
      <Route path="/erc8004/register" component={ERC8004Register} />
      <Route path="/rewards" component={ReferralDashboard} />
      <Route path="/referrals" component={ReferralDashboard} />
      <Route path="/leaderboards" component={ReferralDashboard} />
      <Route path="/r/:code" component={ReferralRedirect} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>
            <TooltipProvider>
              <AuthProvider>
                <div className="min-h-screen bg-background">
                  <HiveLaunchBanner eventEndDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)} />
                  <Header />
                  <NetworkWarningBanner />
                  <main>
                    <Router />
                  </main>
                </div>
                <Toaster />
              </AuthProvider>
            </TooltipProvider>
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
