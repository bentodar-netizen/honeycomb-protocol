import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertTriangle, ChevronDown, Check, Loader2 } from "lucide-react";
import { bsc } from "@/lib/wagmi";

const SUPPORTED_CHAINS = [
  { ...bsc, label: "BNB Chain" },
];

async function addAndSwitchChain(chainId: number) {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  if (!chain || !window.ethereum) return;

  const chainIdHex = `0x${chainId.toString(16)}`;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: chain.rpcUrls.default.http,
            blockExplorerUrls: [chain.blockExplorers?.default?.url],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

export function NetworkSwitcher() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [isPending, setIsPending] = useState(false);

  if (!isConnected) return null;

  const currentChain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  const isUnsupportedNetwork = !currentChain;

  const handleSwitch = async (targetChainId: number) => {
    setIsPending(true);
    try {
      await addAndSwitchChain(targetChainId);
    } catch (e) {
      console.error("Failed to switch network:", e);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isUnsupportedNetwork ? "destructive" : "outline"}
          size="sm"
          className="gap-2"
          disabled={isPending}
          data-testid="button-network-switcher"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isUnsupportedNetwork ? (
            <>
              <AlertTriangle className="h-4 w-4" />
              Wrong Network
            </>
          ) : (
            <>
              <div className="h-2 w-2 rounded-full bg-green-500" />
              {currentChain.label}
            </>
          )}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_CHAINS.map((chain) => (
          <DropdownMenuItem
            key={chain.id}
            onClick={() => handleSwitch(chain.id)}
            className="gap-2 cursor-pointer"
            data-testid={`menu-item-chain-${chain.id}`}
          >
            {chainId === chain.id && <Check className="h-4 w-4 text-green-500" />}
            {chainId !== chain.id && <div className="w-4" />}
            {chain.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NetworkWarningBanner() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [isPending, setIsPending] = useState(false);

  if (!isConnected) return null;

  const isSupported = SUPPORTED_CHAINS.some((c) => c.id === chainId);
  if (isSupported) return null;

  const handleSwitch = async (targetChainId: number) => {
    setIsPending(true);
    try {
      await addAndSwitchChain(targetChainId);
    } catch (e) {
      console.error("Failed to switch network:", e);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2">
      <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span>
            You're connected to an unsupported network. Please switch to BNB Chain.
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => handleSwitch(bsc.id)}
            disabled={isPending}
            data-testid="button-switch-mainnet"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Switch to BNB Chain
          </Button>
        </div>
      </div>
    </div>
  );
}
