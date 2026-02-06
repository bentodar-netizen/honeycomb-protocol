import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  FileText, 
  Lock, 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Shield
} from "lucide-react";
import { formatEther } from "viem";

interface OverviewData {
  identity: {
    identityId: string;
    identityType: string;
    displayName: string;
    primaryAccount: string;
  };
  balances: Array<{
    token: string;
    balance: string;
    dailyLimit: string | null;
    dailySpent: string;
    isFrozen: boolean;
  }>;
  netFlow: {
    inflow24h: string;
    outflow24h: string;
    net24h: string;
  };
  activeEscrowsCount: number;
  pendingInvoicesCount: number;
  recentPayments: Array<{
    id: string;
    fromIdentityId: string;
    toIdentityId: string;
    token: string;
    grossAmountWei: string;
    netAmountWei: string;
    createdAt: string;
    paymentType: string;
  }>;
}

function formatAmount(wei: string): string {
  try {
    const value = formatEther(BigInt(wei));
    return parseFloat(value).toFixed(4);
  } catch {
    return "0";
  }
}

function shortenAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function BeepayOverview() {
  const { address, isConnected } = useAccount();
  
  const { data: overview, isLoading } = useQuery<OverviewData>({
    queryKey: ["/api/beepay/overview", { identityId: address }],
    enabled: isConnected && !!address,
  });

  if (!isConnected) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center py-16">
          <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-6">
            Connect your wallet to access BeePay - the settlement layer for agents
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">BeePay</h1>
        </div>
        <p className="text-muted-foreground">
          The settlement layer for agents on Honeycomb. Fast, secure agent-to-agent payments.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card data-testid="card-balance">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {overview?.balances?.[0] 
                    ? formatAmount(overview.balances[0].balance)
                    : "0"} BNB
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all tokens
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-flow">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Net Flow (24h)</CardTitle>
            {overview && BigInt(overview.netFlow.net24h) >= 0 
              ? <TrendingUp className="h-4 w-4 text-green-500" />
              : <TrendingDown className="h-4 w-4 text-red-500" />
            }
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {overview ? formatAmount(overview.netFlow.net24h) : "0"} BNB
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="text-green-600">
                    +{overview ? formatAmount(overview.netFlow.inflow24h) : "0"} in
                  </span>
                  <span className="text-red-600">
                    -{overview ? formatAmount(overview.netFlow.outflow24h) : "0"} out
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-escrows">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Active Escrows</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {overview?.activeEscrowsCount ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Conditional payments
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-invoices">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {overview?.pendingInvoicesCount ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Awaiting payment
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" data-testid="card-recent-payments">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Payments</CardTitle>
                <CardDescription>Your latest transactions</CardDescription>
              </div>
              <Link href="/beepay/payments">
                <Button variant="outline" size="sm" data-testid="link-view-all-payments">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : overview?.recentPayments?.length ? (
              <div className="space-y-4">
                {overview.recentPayments.slice(0, 5).map(payment => (
                  <div 
                    key={payment.id} 
                    className="flex items-center justify-between p-3 rounded-lg border"
                    data-testid={`payment-item-${payment.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {payment.toIdentityId === address ? (
                        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <ArrowDownRight className="h-4 w-4 text-green-600" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                          <ArrowUpRight className="h-4 w-4 text-red-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">
                          {payment.toIdentityId === address ? "Received" : "Sent"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payment.toIdentityId === address 
                            ? `From ${shortenAddress(payment.fromIdentityId)}`
                            : `To ${shortenAddress(payment.toIdentityId)}`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${payment.toIdentityId === address ? 'text-green-600' : 'text-red-600'}`}>
                        {payment.toIdentityId === address ? '+' : '-'}
                        {formatAmount(payment.netAmountWei)} BNB
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No payments yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-quick-actions">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your BeePay account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/beepay/payments" data-testid="link-quick-payments">
              <Button className="w-full justify-start gap-2" variant="outline" data-testid="button-send-payment">
                <ArrowUpRight className="h-4 w-4" />
                Send Payment
              </Button>
            </Link>
            <Link href="/beepay/invoices" data-testid="link-quick-invoices">
              <Button className="w-full justify-start gap-2" variant="outline" data-testid="button-create-invoice">
                <FileText className="h-4 w-4" />
                Create Invoice
              </Button>
            </Link>
            <Link href="/beepay/escrows" data-testid="link-quick-escrows">
              <Button className="w-full justify-start gap-2" variant="outline" data-testid="button-create-escrow">
                <Lock className="h-4 w-4" />
                Create Escrow
              </Button>
            </Link>
            <Link href="/beepay/budget" data-testid="link-quick-budget">
              <Button className="w-full justify-start gap-2" variant="outline" data-testid="button-manage-budget">
                <Wallet className="h-4 w-4" />
                Manage Budget
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
