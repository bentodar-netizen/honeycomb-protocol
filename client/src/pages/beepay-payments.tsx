import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowUpRight, ArrowDownRight, Send, Clock, Filter } from "lucide-react";
import { formatEther, parseEther } from "viem";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BeepayPayment } from "@shared/schema";

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

export default function BeepayPayments() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [toIdentityId, setToIdentityId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const { data: paymentsData, isLoading } = useQuery<{ payments: BeepayPayment[] }>({
    queryKey: ["/api/beepay/payments", { identityId: address }],
    enabled: isConnected && !!address,
  });

  const sendPaymentMutation = useMutation({
    mutationFn: async (data: { toIdentityId: string; amount: string; memo: string }) => {
      const amountWei = parseEther(data.amount).toString();
      return apiRequest("POST", "/api/beepay/payments", {
        fromIdentityId: address,
        toIdentityId: data.toIdentityId,
        token: "0x0000000000000000000000000000000000000000",
        grossAmountWei: amountWei,
        feeAmountWei: "0",
        netAmountWei: amountWei,
        memo: data.memo,
        payerAccount: address,
        status: "pending"
      });
    },
    onSuccess: () => {
      toast({ title: "Payment sent", description: "Your payment is being processed" });
      queryClient.invalidateQueries({ queryKey: ["/api/beepay/payments", { identityId: address }] });
      queryClient.invalidateQueries({ queryKey: ["/api/beepay/overview", { identityId: address }] });
      setIsDialogOpen(false);
      setToIdentityId("");
      setAmount("");
      setMemo("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send payment", variant: "destructive" });
    }
  });

  const payments = paymentsData?.payments || [];
  const incomingPayments = payments.filter(p => p.toIdentityId === address);
  const outgoingPayments = payments.filter(p => p.fromIdentityId === address);

  if (!isConnected) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center py-16">
          <p className="text-muted-foreground">Connect your wallet to view payments</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">View and send payments</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-payment">
              <Send className="h-4 w-4 mr-2" />
              Send Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Payment</DialogTitle>
              <DialogDescription>Send BNB to another identity</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="toIdentityId">Recipient Identity ID</Label>
                <Input
                  id="toIdentityId"
                  placeholder="0x..."
                  value={toIdentityId}
                  onChange={(e) => setToIdentityId(e.target.value)}
                  data-testid="input-recipient"
                />
              </div>
              <div>
                <Label htmlFor="amount">Amount (BNB)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.0001"
                  placeholder="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="input-amount"
                />
              </div>
              <div>
                <Label htmlFor="memo">Memo (optional)</Label>
                <Input
                  id="memo"
                  placeholder="Payment for..."
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  data-testid="input-memo"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={() => sendPaymentMutation.mutate({ toIdentityId, amount, memo })}
                disabled={!toIdentityId || !amount || sendPaymentMutation.isPending}
                data-testid="button-confirm-send"
              >
                {sendPaymentMutation.isPending ? "Sending..." : "Send Payment"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          <TabsTrigger value="incoming" data-testid="tab-incoming">
            Incoming ({incomingPayments.length})
          </TabsTrigger>
          <TabsTrigger value="outgoing" data-testid="tab-outgoing">
            Outgoing ({outgoingPayments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <PaymentList payments={payments} currentAddress={address || ""} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="incoming">
          <PaymentList payments={incomingPayments} currentAddress={address || ""} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="outgoing">
          <PaymentList payments={outgoingPayments} currentAddress={address || ""} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PaymentList({ 
  payments, 
  currentAddress, 
  isLoading 
}: { 
  payments: BeepayPayment[]; 
  currentAddress: string; 
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading payments...
        </CardContent>
      </Card>
    );
  }

  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No payments found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {payments.map(payment => {
            const isIncoming = payment.toIdentityId === currentAddress;
            return (
              <div 
                key={payment.id} 
                className="flex items-center justify-between p-4 hover:bg-muted/50"
                data-testid={`payment-row-${payment.id}`}
              >
                <div className="flex items-center gap-4">
                  {isIncoming ? (
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <ArrowDownRight className="h-5 w-5 text-green-600" />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                      <ArrowUpRight className="h-5 w-5 text-red-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">
                      {isIncoming ? "Received from" : "Sent to"}{" "}
                      {shortenAddress(isIncoming ? payment.fromIdentityId : payment.toIdentityId)}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{new Date(payment.createdAt).toLocaleString()}</span>
                      <Badge variant="outline" className="text-xs">
                        {payment.paymentType}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>
                    {isIncoming ? '+' : '-'}{formatAmount(payment.netAmountWei)} BNB
                  </p>
                  <Badge 
                    variant={payment.status === 'confirmed' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {payment.status}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
