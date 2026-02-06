import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  useERC8004RegisterAgent, 
  useERC8004AgentBalance,
} from "@/contracts/hooks";
import { getERC8004Addresses } from "@/contracts/addresses";
import { 
  Fingerprint, 
  ShieldCheck, 
  Globe, 
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Bot,
  Star
} from "lucide-react";
import { Link } from "wouter";
import { WalletButton } from "@/components/wallet-button";

export default function ERC8004Register() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();
  const erc8004Addresses = getERC8004Addresses(chainId);
  
  const [agentURI, setAgentURI] = useState("");
  
  const { data: agentBalance, refetch: refetchBalance } = useERC8004AgentBalance(address);
  const { registerAgent, hash, isPending, isConfirming, isSuccess, error } = useERC8004RegisterAgent();

  const handleRegister = () => {
    if (!agentURI.trim()) {
      toast({
        title: "Agent URI Required",
        description: "Please provide a URI for your agent's metadata",
        variant: "destructive",
      });
      return;
    }
    
    try {
      registerAgent(agentURI);
    } catch (err) {
      toast({
        title: "Registration Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (isSuccess) {
    refetchBalance();
  }

  const isBSCNetwork = chainId === 56 || chainId === 97;
  const networkName = chainId === 56 ? "BSC Mainnet" : chainId === 97 ? "BSC Testnet" : "Unsupported";

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Fingerprint className="h-8 w-8 text-amber-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">ERC-8004 Agent Registration</h1>
            <p className="text-muted-foreground">Register your AI agent on-chain with the Trustless Agents standard</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            ERC-721 Compatible
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Globe className="h-3 w-3" />
            BNB Chain
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Star className="h-3 w-3" />
            On-Chain Identity
          </Badge>
        </div>
      </div>

      {!isConnected ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
            <p className="text-muted-foreground mb-6">Connect your wallet to register an agent on ERC-8004</p>
            <WalletButton />
          </CardContent>
        </Card>
      ) : !isBSCNetwork ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <h3 className="text-lg font-semibold mb-2">Wrong Network</h3>
            <p className="text-muted-foreground mb-4">
              Please switch to BSC Mainnet or BSC Testnet to register agents
            </p>
            <Badge variant="secondary">{networkName}</Badge>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-amber-500" />
                Your Registered Agents
              </CardTitle>
              <CardDescription>
                Agents you've registered on ERC-8004 Identity Registry
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Total Agents Owned</p>
                  <p className="text-2xl font-bold">{agentBalance?.toString() || "0"}</p>
                </div>
                <Badge variant="outline" className="gap-1">
                  <Globe className="h-3 w-3" />
                  {networkName}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Register New Agent</CardTitle>
              <CardDescription>
                Create a new on-chain identity for your AI agent. The agent will be minted as an ERC-721 NFT.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="agentURI">Agent Metadata URI</Label>
                <Input
                  id="agentURI"
                  placeholder="https://example.com/agent-metadata.json or ipfs://..."
                  value={agentURI}
                  onChange={(e) => setAgentURI(e.target.value)}
                  data-testid="input-agent-uri"
                />
                <p className="text-xs text-muted-foreground">
                  URI pointing to your agent's metadata JSON file. Can be HTTPS, IPFS, or any accessible URL.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Registration Failed</p>
                    <p className="text-sm text-muted-foreground">{error.message}</p>
                  </div>
                </div>
              )}

              {isSuccess && hash && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400">Agent Registered Successfully!</p>
                    <a 
                      href={`https://${chainId === 97 ? 'testnet.' : ''}bscscan.com/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:underline flex items-center gap-1"
                    >
                      View transaction <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              <Button 
                onClick={handleRegister}
                disabled={isPending || isConfirming || !agentURI.trim()}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                data-testid="button-register-agent"
              >
                {isPending || isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isConfirming ? "Confirming..." : "Registering..."}
                  </>
                ) : (
                  <>
                    <Fingerprint className="h-4 w-4 mr-2" />
                    Register Agent on ERC-8004
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contract Addresses</CardTitle>
              <CardDescription>ERC-8004 contracts on {networkName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Identity Registry</p>
                <a
                  href={`https://${chainId === 97 ? 'testnet.' : ''}bscscan.com/address/${erc8004Addresses?.identityRegistry}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground font-mono hover:underline flex items-center gap-1"
                >
                  {erc8004Addresses?.identityRegistry} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Reputation Registry</p>
                <a
                  href={`https://${chainId === 97 ? 'testnet.' : ''}bscscan.com/address/${erc8004Addresses?.reputationRegistry}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground font-mono hover:underline flex items-center gap-1"
                >
                  {erc8004Addresses?.reputationRegistry} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <Link href="/nfa">
              <Button variant="outline" data-testid="link-nfa-marketplace">
                View NFA Marketplace
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
