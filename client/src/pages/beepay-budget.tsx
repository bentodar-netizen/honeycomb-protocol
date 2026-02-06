import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Wallet, Shield, AlertTriangle, Settings, Plus } from "lucide-react";
import { formatEther, parseEther } from "viem";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BeepayBudget } from "@shared/schema";

function formatAmount(wei: string): string {
  try {
    const value = formatEther(BigInt(wei));
    return parseFloat(value).toFixed(4);
  } catch {
    return "0";
  }
}

export default function BeepayBudget() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [newDailyLimit, setNewDailyLimit] = useState("");

  const { data: budgetsData, isLoading } = useQuery<{ budgets: BeepayBudget[] }>({
    queryKey: ["/api/beepay/budgets", { identityId: address }],
    enabled: isConnected && !!address,
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async (data: { token: string; dailyLimitWei?: string; isFrozen?: boolean }) => {
      return apiRequest("PATCH", `/api/beepay/budgets/${address}/${data.token}`, {
        dailyLimitWei: data.dailyLimitWei,
        isFrozen: data.isFrozen
      });
    },
    onSuccess: () => {
      toast({ title: "Budget updated", description: "Your budget settings have been saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/beepay/budgets", { identityId: address }] });
      queryClient.invalidateQueries({ queryKey: ["/api/beepay/overview", { identityId: address }] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update budget", variant: "destructive" });
    }
  });

  const budgets = budgetsData?.budgets || [];

  if (!isConnected) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center py-16">
          <p className="text-muted-foreground">Connect your wallet to manage budget</p>
        </div>
      </div>
    );
  }

  const hasBudget = budgets.length > 0;

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Budget Controls</h1>
        <p className="text-muted-foreground">Manage spending limits and security settings</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-daily-limits">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Daily Spending Limits
            </CardTitle>
            <CardDescription>
              Set maximum daily spending per token to prevent overdrafts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : !hasBudget ? (
              <div className="text-center py-8">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">No budget configured yet</p>
                <p className="text-sm text-muted-foreground">
                  Deposit funds to your BeePay vault to get started
                </p>
              </div>
            ) : (
              budgets.map(budget => {
                const spent = BigInt(budget.dailySpentWei);
                const limit = budget.dailyLimitWei ? BigInt(budget.dailyLimitWei) : BigInt(0);
                const percentage = limit > 0 ? Number((spent * BigInt(100)) / limit) : 0;
                
                return (
                  <div key={budget.id} className="space-y-3" data-testid={`budget-item-${budget.token}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {budget.token === "0x0000000000000000000000000000000000000000" ? "BNB" : "ERC20"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Balance: {formatAmount(budget.balanceWei)} BNB
                        </p>
                      </div>
                      {budget.isFrozen && (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Frozen
                        </Badge>
                      )}
                    </div>
                    
                    {limit > 0 && (
                      <>
                        <Progress value={Math.min(percentage, 100)} className="h-2" />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Spent: {formatAmount(budget.dailySpentWei)}</span>
                          <span>Limit: {formatAmount(budget.dailyLimitWei || "0")}</span>
                        </div>
                      </>
                    )}
                    
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="New daily limit (BNB)"
                        value={newDailyLimit}
                        onChange={(e) => setNewDailyLimit(e.target.value)}
                        className="flex-1"
                        data-testid="input-daily-limit"
                      />
                      <Button 
                        onClick={() => {
                          if (newDailyLimit) {
                            updateBudgetMutation.mutate({
                              token: budget.token,
                              dailyLimitWei: parseEther(newDailyLimit).toString()
                            });
                            setNewDailyLimit("");
                          }
                        }}
                        disabled={!newDailyLimit || updateBudgetMutation.isPending}
                        data-testid="button-set-limit"
                      >
                        Set
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-security">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Controls
            </CardTitle>
            <CardDescription>
              Emergency controls and allowed targets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Emergency Freeze</p>
                  <p className="text-sm text-muted-foreground">
                    Freeze all spending from your vault
                  </p>
                </div>
                <Switch 
                  checked={budgets[0]?.isFrozen || false}
                  onCheckedChange={(checked) => {
                    if (budgets[0]) {
                      updateBudgetMutation.mutate({
                        token: budgets[0].token,
                        isFrozen: checked
                      });
                    }
                  }}
                  data-testid="switch-freeze"
                />
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium">Allowed Targets</p>
                    <p className="text-sm text-muted-foreground">
                      Contracts your agent can interact with
                    </p>
                  </div>
                  <Button size="sm" variant="outline" data-testid="button-add-target">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                    <span className="font-mono">Paymaster</span>
                    <Badge variant="outline">Allowed</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                    <span className="font-mono">EscrowCore</span>
                    <Badge variant="outline">Allowed</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Security Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Set daily limits to prevent unexpected large transactions</li>
                <li>Only allow trusted contracts as spending targets</li>
                <li>Use emergency freeze if you suspect unauthorized access</li>
                <li>Regularly review your transaction history</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
