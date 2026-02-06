import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";

export default function GmgnDocs() {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const contracts = [
    { name: "Bonding Curve Market", address: "0x960518eC278b5a78bD1B5fC1b2E22abC5DB1A167" },
    { name: "Token Factory", address: "0x61fcCc3c52F537E9E5434aA472130b8C03500e10" },
    { name: "Fee Vault", address: "0x5077Df490A68d4bA33208c9308739B17da6CcBb7" },
    { name: "Migration", address: "0xa95a5d8237A1932b315c50eFB92e3086EB8eAf01" },
    { name: "Router", address: "0x246e121A4df577046BaEdf87d5F68968bc24c52E" },
  ];

  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Honeycomb - The Hatchery</h1>
        <p className="text-muted-foreground text-lg">DEX Aggregator Integration Documentation</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <Badge>BNB Chain</Badge>
          <Badge variant="outline">Chain ID: 56</Badge>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Project Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            The Hatchery is a token launchpad on BNB Chain where tokens are instantly tradeable 
            via a bonding curve AMM. Tokens graduate to PancakeSwap V2 when they reach $50k market cap.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="https://thehoneycomb.social" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Website
              </Button>
            </a>
            <a href="https://twitter.com/honeycombchain" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Twitter
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Contract Addresses (BSC Mainnet)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {contracts.map((contract) => (
              <div key={contract.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{contract.name}</p>
                  <code className="text-xs text-muted-foreground break-all">{contract.address}</code>
                </div>
                <div className="flex gap-2 shrink-0 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(contract.address, contract.name)}
                  >
                    {copiedField === contract.name ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <a
                    href={`https://bscscan.com/address/${contract.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Trading Functions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold mb-2">Buy Tokens</h4>
            <code className="text-sm block bg-background p-2 rounded">
              function buyTokens(address token) external payable
            </code>
            <p className="text-sm text-muted-foreground mt-2">
              Send BNB to buy tokens. Emits TokensBought event.
            </p>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold mb-2">Sell Tokens</h4>
            <code className="text-sm block bg-background p-2 rounded">
              function sellTokens(address token, uint256 tokenAmount) external
            </code>
            <p className="text-sm text-muted-foreground mt-2">
              Requires token approval first. Emits TokensSold event.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Price Query Functions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2">Get Price</h4>
              <code className="text-xs block">getPrice(address token) returns (uint256)</code>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2">Get Buy Quote</h4>
              <code className="text-xs block">getBuyQuote(address token, uint256 nativeAmount)</code>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2">Get Sell Quote</h4>
              <code className="text-xs block">getSellQuote(address token, uint256 tokenAmount)</code>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2">Get Market State</h4>
              <code className="text-xs block">getMarketState(address token)</code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Events for Indexing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 border-l-4 border-green-500 bg-muted/50 rounded-r-lg">
              <code className="text-sm font-semibold">TokensBought</code>
              <p className="text-xs text-muted-foreground mt-1">
                (address indexed token, address indexed buyer, uint256 nativeIn, uint256 tokensOut)
              </p>
            </div>
            <div className="p-3 border-l-4 border-red-500 bg-muted/50 rounded-r-lg">
              <code className="text-sm font-semibold">TokensSold</code>
              <p className="text-xs text-muted-foreground mt-1">
                (address indexed token, address indexed seller, uint256 tokensIn, uint256 nativeOut)
              </p>
            </div>
            <div className="p-3 border-l-4 border-blue-500 bg-muted/50 rounded-r-lg">
              <code className="text-sm font-semibold">TokenCreated</code>
              <p className="text-xs text-muted-foreground mt-1">
                (address indexed token, address indexed creator, string name, string symbol)
              </p>
            </div>
            <div className="p-3 border-l-4 border-amber-500 bg-muted/50 rounded-r-lg">
              <code className="text-sm font-semibold">TokenGraduated</code>
              <p className="text-xs text-muted-foreground mt-1">
                (address indexed token, uint256 totalRaised)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Bonding Curve Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">Constant Product</p>
              <p className="text-sm text-muted-foreground">x * y = k</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">1%</p>
              <p className="text-sm text-muted-foreground">Trading Fee</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">$50k</p>
              <p className="text-sm text-muted-foreground">Graduation Threshold</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">ERC-20</p>
              <p className="text-sm text-muted-foreground">Token Standard</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 font-mono text-sm">
            <div className="p-2 bg-muted/50 rounded">
              <span className="text-green-500">GET</span> /api/launch/tokens - List all tokens
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <span className="text-green-500">GET</span> /api/launch/tokens/:address - Token details
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <span className="text-green-500">GET</span> /api/launch/tokens/:address/trades - Trade history
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <span className="text-green-500">GET</span> /api/launch/trending - Trending tokens
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center mt-8 text-muted-foreground text-sm">
        <p>All tokens launched through The Hatchery have contract addresses ending in "bee"</p>
      </div>
    </div>
  );
}
