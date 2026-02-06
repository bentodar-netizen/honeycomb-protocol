import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Plus, Clock, CheckCircle, XCircle, Copy } from "lucide-react";
import { formatEther, parseEther } from "viem";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BeepayInvoice } from "@shared/schema";

function formatAmount(wei: string): string {
  try {
    const value = formatEther(BigInt(wei));
    return parseFloat(value).toFixed(4);
  } catch {
    return "0";
  }
}

function shortenHash(hash: string): string {
  if (!hash) return "";
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export default function BeepayInvoices() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [buyerIdentityId, setBuyerIdentityId] = useState("");
  const [amount, setAmount] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [terms, setTerms] = useState("");

  const { data: invoicesData, isLoading } = useQuery<{ invoices: BeepayInvoice[] }>({
    queryKey: ["/api/beepay/invoices", { identityId: address }],
    enabled: isConnected && !!address,
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: { buyerIdentityId: string; amount: string; serviceType: string; terms: string }) => {
      const amountWei = parseEther(data.amount).toString();
      return apiRequest("POST", "/api/beepay/invoices", {
        sellerIdentityId: address,
        buyerIdentityId: data.buyerIdentityId || null,
        token: "0x0000000000000000000000000000000000000000",
        amountWei,
        amountDisplay: `${data.amount} BNB`,
        serviceType: data.serviceType,
        terms: data.terms
      });
    },
    onSuccess: () => {
      toast({ title: "Invoice created", description: "Your invoice has been created" });
      queryClient.invalidateQueries({ queryKey: ["/api/beepay/invoices", { identityId: address }] });
      queryClient.invalidateQueries({ queryKey: ["/api/beepay/overview", { identityId: address }] });
      setIsDialogOpen(false);
      setBuyerIdentityId("");
      setAmount("");
      setServiceType("");
      setTerms("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create invoice", variant: "destructive" });
    }
  });

  const invoices = invoicesData?.invoices || [];
  const sentInvoices = invoices.filter(i => i.sellerIdentityId === address);
  const receivedInvoices = invoices.filter(i => i.buyerIdentityId === address);

  if (!isConnected) {
    return (
      <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center py-16">
          <p className="text-muted-foreground">Connect your wallet to view invoices</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Create and manage payment requests</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-invoice">
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
              <DialogDescription>Request payment from another identity</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="buyerIdentityId">Buyer Identity ID (optional)</Label>
                <Input
                  id="buyerIdentityId"
                  placeholder="Leave empty for open invoice"
                  value={buyerIdentityId}
                  onChange={(e) => setBuyerIdentityId(e.target.value)}
                  data-testid="input-buyer"
                />
              </div>
              <div>
                <Label htmlFor="invoiceAmount">Amount (BNB)</Label>
                <Input
                  id="invoiceAmount"
                  type="number"
                  step="0.0001"
                  placeholder="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="input-invoice-amount"
                />
              </div>
              <div>
                <Label htmlFor="serviceType">Service Type</Label>
                <Input
                  id="serviceType"
                  placeholder="e.g., API Access, Consulting"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  data-testid="input-service-type"
                />
              </div>
              <div>
                <Label htmlFor="terms">Terms & Description</Label>
                <Textarea
                  id="terms"
                  placeholder="Describe the service or terms..."
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  data-testid="input-terms"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={() => createInvoiceMutation.mutate({ buyerIdentityId, amount, serviceType, terms })}
                disabled={!amount || createInvoiceMutation.isPending}
                data-testid="button-confirm-create-invoice"
              >
                {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="sent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sent" data-testid="tab-sent">
            Sent ({sentInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="received" data-testid="tab-received">
            Received ({receivedInvoices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sent">
          <InvoiceList invoices={sentInvoices} isSeller={true} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="received">
          <InvoiceList invoices={receivedInvoices} isSeller={false} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InvoiceList({ 
  invoices, 
  isSeller,
  isLoading 
}: { 
  invoices: BeepayInvoice[]; 
  isSeller: boolean;
  isLoading: boolean;
}) {
  const { toast } = useToast();

  const copyInvoiceHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast({ title: "Copied", description: "Invoice hash copied to clipboard" });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading invoices...
        </CardContent>
      </Card>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            {isSeller ? "No invoices sent yet" : "No invoices received"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {invoices.map(invoice => (
        <Card key={invoice.id} data-testid={`invoice-card-${invoice.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="font-medium">{invoice.serviceType || "Payment Request"}</span>
                  <StatusBadge status={invoice.status} />
                </div>
                <p className="text-2xl font-bold">{invoice.amountDisplay}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Hash: {shortenHash(invoice.invoiceHash)}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => copyInvoiceHash(invoice.invoiceHash)}
                    data-testid="button-copy-hash"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                {invoice.terms && (
                  <p className="text-sm text-muted-foreground">{invoice.terms}</p>
                )}
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Created {new Date(invoice.createdAt).toLocaleDateString()}</p>
                {invoice.expiresAt && (
                  <p>Expires {new Date(invoice.expiresAt).toLocaleDateString()}</p>
                )}
              </div>
            </div>
            {!isSeller && invoice.status === "pending" && (
              <div className="mt-4 pt-4 border-t">
                <Button className="w-full" data-testid="button-pay-invoice">
                  Pay Invoice
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
    case "expired":
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Expired</Badge>;
    case "cancelled":
      return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
    default:
      return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  }
}
