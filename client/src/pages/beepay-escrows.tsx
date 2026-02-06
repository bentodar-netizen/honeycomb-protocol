import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Lock, Plus, Clock, CheckCircle, XCircle, AlertTriangle, Users, Shield } from "lucide-react";
import { formatEther, parseEther } from "viem";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BeepayEscrow } from "@shared/schema";

function formatAmount(wei: string): string {
  try {
    const value = formatEther(BigInt(wei));
    return parseFloat(value).toFixed(4);
  } catch {
    return "0";
  }
}

export default function BeepayEscrows() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [payeeId, setPayeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [terms, setTerms] = useState("");
  const [conditionModule, setConditionModule] = useState("mutual_sign");
  const [deadline, setDeadline] = useState("");

  const { data: escrowsData, isLoading } = useQuery<{ escrows: BeepayEscrow[] }>({
    queryKey: ["/api/beepay/escrows", { identityId: address }],
    enabled: isConnected && !!address,
  });

  const createEscrowMutation = useMutation({
    mutationFn: async (data: { payeeId: string; amount: string; terms: string; conditionModule: string; deadline: string }) => {
      const amountWei = parseEther(data.amount).toString();
      const deadlineDate = new Date(data.deadline);
      return apiRequest("POST", "/api/beepay/escrows", {
        payerId: address,
        payeeId: data.payeeId,
        token: "0x0000000000000000000000000000000000000000",
        amountWei,
        amountDisplay: `${data.amount} BNB`,
        deadline: deadlineDate.toISOString(),
        terms: data.terms,
        conditionModule: data.conditionModule
      });
    },
    onSuccess: () => {
      toast({ title: "Escrow created", description: "Your escrow has been created" });
      queryClient.invalidateQueries({ queryKey: ["/api/beepay/escrows", { identityId: address }] });
      queryClient.invalidateQueries({ queryKey: ["/api/beepay/overview", { identityId: address }] });
      setIsDialogOpen(false);
      setPayeeId("");
      setAmount("");
      setTerms("");
      setDeadline("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create escrow", variant: "destructive" });
    }
  });

  const escrows = escrowsData?.escrows || [];
  const activeEscrows = escrows.filter(e => e.status === "funded" || e.status === "created");
  const completedEscrows = escrows.filter(e => e.status === "released" || e.status === "refunded");

  if (!isConnected) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center py-16">
          <p className="text-muted-foreground">Connect your wallet to view escrows</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Escrows</h1>
          <p className="text-muted-foreground">Conditional payments with trustless release</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-escrow">
              <Plus className="h-4 w-4 mr-2" />
              Create Escrow
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Escrow</DialogTitle>
              <DialogDescription>Set up a conditional payment</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="payeeId">Payee Identity ID</Label>
                <Input
                  id="payeeId"
                  placeholder="0x..."
                  value={payeeId}
                  onChange={(e) => setPayeeId(e.target.value)}
                  data-testid="input-payee"
                />
              </div>
              <div>
                <Label htmlFor="escrowAmount">Amount (BNB)</Label>
                <Input
                  id="escrowAmount"
                  type="number"
                  step="0.0001"
                  placeholder="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="input-escrow-amount"
                />
              </div>
              <div>
                <Label htmlFor="conditionModule">Release Condition</Label>
                <Select value={conditionModule} onValueChange={setConditionModule}>
                  <SelectTrigger data-testid="select-condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mutual_sign">Mutual Signature</SelectItem>
                    <SelectItem value="quorum">Validator Quorum</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {conditionModule === "mutual_sign" 
                    ? "Both parties must sign to release funds"
                    : "K-of-N validators must approve the release"
                  }
                </p>
              </div>
              <div>
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  data-testid="input-deadline"
                />
              </div>
              <div>
                <Label htmlFor="escrowTerms">Terms & Description</Label>
                <Textarea
                  id="escrowTerms"
                  placeholder="Describe the conditions for release..."
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  data-testid="input-escrow-terms"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={() => createEscrowMutation.mutate({ payeeId, amount, terms, conditionModule, deadline })}
                disabled={!payeeId || !amount || !deadline || createEscrowMutation.isPending}
                data-testid="button-confirm-create-escrow"
              >
                {createEscrowMutation.isPending ? "Creating..." : "Create Escrow"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active">
            Active ({activeEscrows.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({completedEscrows.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <EscrowList escrows={activeEscrows} currentAddress={address || ""} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="completed">
          <EscrowList escrows={completedEscrows} currentAddress={address || ""} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EscrowList({ 
  escrows, 
  currentAddress,
  isLoading 
}: { 
  escrows: BeepayEscrow[]; 
  currentAddress: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading escrows...
        </CardContent>
      </Card>
    );
  }

  if (escrows.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No escrows found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {escrows.map(escrow => {
        const isPayer = escrow.payerId === currentAddress;
        return (
          <Card key={escrow.id} data-testid={`escrow-card-${escrow.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    <span className="font-medium">
                      {isPayer ? "You are paying" : "You are receiving"}
                    </span>
                    <StatusBadge status={escrow.status} />
                  </div>
                  <p className="text-2xl font-bold">{escrow.amountDisplay}</p>
                </div>
                <div className="text-right">
                  <ConditionBadge condition={escrow.conditionModule} />
                  <p className="text-sm text-muted-foreground mt-1">
                    Deadline: {new Date(escrow.deadline).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {escrow.terms && (
                <div className="p-3 bg-muted rounded-lg mb-4">
                  <p className="text-sm">{escrow.terms}</p>
                </div>
              )}

              {escrow.status === "funded" && (
                <div className="flex gap-2">
                  <Button className="flex-1" variant="default" data-testid="button-approve-release">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve Release
                  </Button>
                  {isPayer && (
                    <Button variant="outline" data-testid="button-dispute">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Dispute
                    </Button>
                  )}
                </div>
              )}

              {escrow.status === "created" && isPayer && (
                <Button className="w-full" data-testid="button-fund-escrow">
                  Fund Escrow
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "released":
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Released</Badge>;
    case "refunded":
      return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Refunded</Badge>;
    case "disputed":
      return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Disputed</Badge>;
    case "funded":
      return <Badge className="bg-blue-100 text-blue-800"><Lock className="h-3 w-3 mr-1" />Funded</Badge>;
    default:
      return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Created</Badge>;
  }
}

function ConditionBadge({ condition }: { condition: string }) {
  if (condition === "mutual_sign") {
    return (
      <Badge variant="outline" className="gap-1">
        <Users className="h-3 w-3" />
        Mutual Sign
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Shield className="h-3 w-3" />
      Validator Quorum
    </Badge>
  );
}
