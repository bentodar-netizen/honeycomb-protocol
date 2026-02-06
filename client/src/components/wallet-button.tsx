import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, ChevronDown, LogOut, Copy, CheckCircle, ExternalLink, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (error) {
      // Don't show confusing provider errors when in iframe - user should open in new tab
      const isProviderError = error.message?.includes("Provider not found") || 
                              error.message?.includes("No provider");
      if (isInIframe() && isProviderError) {
        toast({
          title: "Open in New Tab for MetaMask",
          description: "Browser wallets don't work in embedded views. Use WalletConnect or open in a new tab.",
        });
      } else {
        toast({
          title: "Wallet connection failed",
          description: error.message || "Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [error, toast]);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast({ title: "Address copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleConnect = async (connector: typeof connectors[0]) => {
    try {
      connect({ connector });
    } catch (err) {
      console.error("Connection error:", err);
    }
  };

  if (!isConnected) {
    const walletConnectConnector = connectors.find(c => c.name === "WalletConnect");
    const injectedConnector = connectors.find(c => c.name === "Injected" || c.id === "injected");

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            className="gap-2"
            disabled={isPending}
            data-testid="button-connect-wallet"
          >
            <Wallet className="h-4 w-4" />
            {isPending ? "Connecting..." : "Connect Wallet"}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {walletConnectConnector && (
            <DropdownMenuItem
              onClick={() => handleConnect(walletConnectConnector)}
              className="cursor-pointer flex flex-col items-start gap-0.5"
              data-testid="button-connect-walletconnect"
            >
              <span className="font-medium">WalletConnect</span>
              <span className="text-xs text-muted-foreground">
                Scan QR or use mobile wallet
              </span>
            </DropdownMenuItem>
          )}
          {injectedConnector && (
            <DropdownMenuItem
              onClick={() => handleConnect(injectedConnector)}
              className="cursor-pointer flex flex-col items-start gap-0.5"
              data-testid="button-connect-injected"
            >
              <span className="font-medium">Browser Wallet</span>
              <span className="text-xs text-muted-foreground">
                MetaMask, Trust Wallet, etc.
              </span>
            </DropdownMenuItem>
          )}
          {isInIframe() && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-2 bg-amber-50 dark:bg-amber-950 rounded-md mx-1 mb-1">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                      Browser wallet not working?
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                      Open this app in a new tab for MetaMask
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-xs gap-1"
                      onClick={() => window.open(window.location.href, '_blank')}
                      data-testid="button-open-new-tab"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open in New Tab
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
          {connectors.length === 0 && (
            <div className="px-2 py-3 text-center">
              <p className="text-sm text-muted-foreground">No wallet available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Install a Web3 wallet to continue
              </p>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className="gap-2"
          data-testid="button-wallet-menu"
        >
          <div className="h-2 w-2 rounded-full bg-green-500" />
          {formatAddress(address!)}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground">Connected to</p>
          <p className="text-sm font-medium">{chain?.name || "Unknown"}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyAddress} className="cursor-pointer">
          {copied ? (
            <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => disconnect()}
          className="cursor-pointer text-destructive"
          data-testid="button-disconnect-wallet"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
