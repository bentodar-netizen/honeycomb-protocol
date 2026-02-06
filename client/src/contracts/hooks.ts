// Contract interaction hooks using wagmi
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useBalance, useSimulateContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { 
  HoneycombAgentRegistryABI,
  HoneycombBountyEscrowABI,
  HoneycombPostBondABI,
  HoneycombReputationABI,
  HoneycombTokenFactoryABI,
  HoneycombBondingCurveMarketABI,
  HoneycombTokenABI,
  HoneycombMigrationABI,
  HoneycombPredictDuelABI,
  ERC8004IdentityRegistryABI,
  ERC8004ReputationRegistryABI,
} from './abis';
import { getContractAddresses, getDexConfig, getERC8004Addresses } from './addresses';

// ============= Agent Registry Hooks =============

export function useAgentRegistryAddress() {
  const chainId = useChainId();
  return getContractAddresses(chainId)?.agentRegistry;
}

export function useAgentExists(agentId?: bigint) {
  const address = useAgentRegistryAddress();
  return useReadContract({
    address,
    abi: HoneycombAgentRegistryABI,
    functionName: 'agentExists',
    args: agentId !== undefined ? [agentId] : undefined,
    query: { enabled: agentId !== undefined && !!address },
  });
}

export function useGetAgentByOwner(walletAddress?: `0x${string}`) {
  const address = useAgentRegistryAddress();
  return useReadContract({
    address,
    abi: HoneycombAgentRegistryABI,
    functionName: 'getAgentByOwner',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && !!address },
  });
}

export function useGetAgent(agentId?: bigint) {
  const address = useAgentRegistryAddress();
  return useReadContract({
    address,
    abi: HoneycombAgentRegistryABI,
    functionName: 'getAgent',
    args: agentId !== undefined ? [agentId] : undefined,
    query: { enabled: agentId !== undefined && !!address },
  });
}

export function useTotalAgents() {
  const address = useAgentRegistryAddress();
  return useReadContract({
    address,
    abi: HoneycombAgentRegistryABI,
    functionName: 'totalAgents',
    query: { enabled: !!address },
  });
}

export function useRegisterAgent() {
  const address = useAgentRegistryAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const registerAgent = (metadataCID: string) => {
    if (!address) return;
    writeContract({
      address,
      abi: HoneycombAgentRegistryABI,
      functionName: 'registerAgent',
      args: [metadataCID],
    });
  };
  
  return { registerAgent, isPending, isConfirming, isSuccess, hash, error };
}

export function useUpdateAgent() {
  const address = useAgentRegistryAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const updateAgent = (agentId: bigint, newMetadataCID: string) => {
    if (!address) return;
    writeContract({
      address,
      abi: HoneycombAgentRegistryABI,
      functionName: 'updateAgent',
      args: [agentId, newMetadataCID],
    });
  };
  
  return { updateAgent, isPending, isConfirming, isSuccess, hash, error };
}

// ============= Bounty Escrow Hooks =============

export function useBountyEscrowAddress() {
  const chainId = useChainId();
  return getContractAddresses(chainId)?.bountyEscrow;
}

export function useGetBounty(bountyId?: bigint) {
  const address = useBountyEscrowAddress();
  return useReadContract({
    address,
    abi: HoneycombBountyEscrowABI,
    functionName: 'getBounty',
    args: bountyId !== undefined ? [bountyId] : undefined,
    query: { enabled: bountyId !== undefined && !!address },
  });
}

export function useGetSolution(bountyId?: bigint, solutionId?: bigint) {
  const address = useBountyEscrowAddress();
  return useReadContract({
    address,
    abi: HoneycombBountyEscrowABI,
    functionName: 'getSolution',
    args: bountyId !== undefined && solutionId !== undefined ? [bountyId, solutionId] : undefined,
    query: { enabled: bountyId !== undefined && solutionId !== undefined && !!address },
  });
}

export function useTotalBounties() {
  const address = useBountyEscrowAddress();
  return useReadContract({
    address,
    abi: HoneycombBountyEscrowABI,
    functionName: 'totalBounties',
    query: { enabled: !!address },
  });
}

export function useCreateBounty() {
  const address = useBountyEscrowAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const createBounty = (agentId: bigint, bountyCID: string, deadline: bigint, rewardBnb: string) => {
    if (!address) return;
    writeContract({
      address,
      abi: HoneycombBountyEscrowABI,
      functionName: 'createBounty',
      args: [agentId, bountyCID, deadline],
      value: parseEther(rewardBnb),
    });
  };
  
  return { createBounty, isPending, isConfirming, isSuccess, hash, error };
}

export function useSubmitSolution() {
  const address = useBountyEscrowAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const submitSolution = (bountyId: bigint, agentId: bigint, solutionCID: string) => {
    if (!address) return;
    writeContract({
      address,
      abi: HoneycombBountyEscrowABI,
      functionName: 'submitSolution',
      args: [bountyId, agentId, solutionCID],
    });
  };
  
  return { submitSolution, isPending, isConfirming, isSuccess, hash, error };
}

export function useAwardSolution() {
  const address = useBountyEscrowAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const awardSolution = (bountyId: bigint, solutionId: bigint) => {
    if (!address) return;
    writeContract({
      address,
      abi: HoneycombBountyEscrowABI,
      functionName: 'awardSolution',
      args: [bountyId, solutionId],
    });
  };
  
  return { awardSolution, isPending, isConfirming, isSuccess, hash, error };
}

export function useCancelBounty() {
  const address = useBountyEscrowAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const cancelBounty = (bountyId: bigint) => {
    if (!address) return;
    writeContract({
      address,
      abi: HoneycombBountyEscrowABI,
      functionName: 'cancelBounty',
      args: [bountyId],
    });
  };
  
  return { cancelBounty, isPending, isConfirming, isSuccess, hash, error };
}

// ============= Post Bond Hooks =============

export function usePostBondAddress() {
  const chainId = useChainId();
  return getContractAddresses(chainId)?.postBond;
}

export function useGetPost(postId?: bigint) {
  const address = usePostBondAddress();
  return useReadContract({
    address,
    abi: HoneycombPostBondABI,
    functionName: 'getPost',
    args: postId !== undefined ? [postId] : undefined,
    query: { enabled: postId !== undefined && !!address },
  });
}

export function useBondAmount() {
  const address = usePostBondAddress();
  return useReadContract({
    address,
    abi: HoneycombPostBondABI,
    functionName: 'bondAmount',
    query: { enabled: !!address },
  });
}

export function useChallengeStake() {
  const address = usePostBondAddress();
  return useReadContract({
    address,
    abi: HoneycombPostBondABI,
    functionName: 'challengeStake',
    query: { enabled: !!address },
  });
}

export function useCreatePostBond() {
  const address = usePostBondAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const createPost = (agentId: bigint, contentCID: string, bondBnb: string) => {
    if (!address) return;
    writeContract({
      address,
      abi: HoneycombPostBondABI,
      functionName: 'createPost',
      args: [agentId, contentCID],
      value: parseEther(bondBnb),
    });
  };
  
  return { createPost, isPending, isConfirming, isSuccess, hash, error };
}

export function useChallengePost() {
  const address = usePostBondAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const challengePost = (postId: bigint, reason: string, stakeBnb: string) => {
    if (!address) return;
    writeContract({
      address,
      abi: HoneycombPostBondABI,
      functionName: 'challengePost',
      args: [postId, reason],
      value: parseEther(stakeBnb),
    });
  };
  
  return { challengePost, isPending, isConfirming, isSuccess, hash, error };
}

// ============= Reputation Hooks =============

export function useReputationAddress() {
  const chainId = useChainId();
  return getContractAddresses(chainId)?.reputation;
}

export function useReputationsOf(agentIds?: readonly bigint[]) {
  const address = useReputationAddress();
  return useReadContract({
    address,
    abi: HoneycombReputationABI,
    functionName: 'reputationsOf',
    args: agentIds ? [agentIds] : undefined,
    query: { enabled: !!agentIds && agentIds.length > 0 && !!address },
  });
}

export function useLastUpdatedAt(agentId?: bigint) {
  const address = useReputationAddress();
  return useReadContract({
    address,
    abi: HoneycombReputationABI,
    functionName: 'lastUpdatedAt',
    args: agentId !== undefined ? [agentId] : undefined,
    query: { enabled: agentId !== undefined && !!address },
  });
}

// ============= Token Factory Hooks (Launchpad) =============

export function useTokenFactoryAddress() {
  const chainId = useChainId();
  return getContractAddresses(chainId)?.tokenFactory;
}

export function useBondingCurveMarketAddress() {
  const chainId = useChainId();
  return getContractAddresses(chainId)?.bondingCurveMarket;
}

export function useCreateToken() {
  const address = useTokenFactoryAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const createToken = (name: string, symbol: string, metadataCID: string, creatorBeeId: bigint = BigInt(0), salt: `0x${string}` = `0x${'0'.repeat(64)}`) => {
    console.log("useCreateToken called with:", { name, symbol, metadataCID, creatorBeeId: creatorBeeId.toString(), salt, factoryAddress: address });
    if (!address) {
      console.error("Factory address is null or undefined");
      return;
    }
    console.log("Calling writeContract with factory address:", address);
    writeContract({
      address,
      abi: HoneycombTokenFactoryABI,
      functionName: 'createToken',
      args: [name, symbol, metadataCID, creatorBeeId, salt],
    });
  };
  
  return { createToken, isPending, isConfirming, isSuccess, hash, error };
}

export function useInitializeMarket() {
  const address = useBondingCurveMarketAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const initializeMarket = (tokenAddress: `0x${string}`) => {
    console.log("useInitializeMarket called with:", { tokenAddress, marketAddress: address });
    if (!address) {
      console.error("Market address is null or undefined");
      return;
    }
    writeContract({
      address,
      abi: HoneycombBondingCurveMarketABI,
      functionName: 'initializeMarket',
      args: [tokenAddress],
    });
  };
  
  return { initializeMarket, isPending, isConfirming, isSuccess, hash, error };
}

export function usePredictTokenAddressSingle(
  name?: string,
  symbol?: string,
  metadataCID?: string,
  creatorBeeId?: bigint,
  salt?: `0x${string}`
) {
  const address = useTokenFactoryAddress();
  const enabled = !!address && !!name && !!symbol && !!metadataCID && creatorBeeId !== undefined && !!salt;
  
  return useReadContract({
    address,
    abi: HoneycombTokenFactoryABI,
    functionName: 'predictTokenAddress',
    args: enabled ? [name!, symbol!, metadataCID!, creatorBeeId!, salt!] : undefined,
    query: { enabled },
  });
}

export function usePredictTokenAddress() {
  const address = useTokenFactoryAddress();
  
  return { factoryAddress: address };
}

export function useGetAllTokens() {
  const address = useTokenFactoryAddress();
  return useReadContract({
    address,
    abi: HoneycombTokenFactoryABI,
    functionName: 'allTokens',
    query: { enabled: !!address },
  });
}

export function useGetTokenCount() {
  const address = useTokenFactoryAddress();
  return useReadContract({
    address,
    abi: HoneycombTokenFactoryABI,
    functionName: 'totalTokens',
    query: { enabled: !!address },
  });
}

export function useIsHoneycombToken(tokenAddress?: `0x${string}`) {
  const address = useTokenFactoryAddress();
  return useReadContract({
    address,
    abi: HoneycombTokenFactoryABI,
    functionName: 'isHoneycombToken',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled: !!tokenAddress && !!address },
  });
}

// ============= Bonding Curve Market Hooks (Launchpad) =============

export function useGetMarketState(tokenAddress?: `0x${string}`) {
  const address = useBondingCurveMarketAddress();
  return useReadContract({
    address,
    abi: HoneycombBondingCurveMarketABI,
    functionName: 'getMarketState',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled: !!tokenAddress && !!address },
  });
}

export function useQuoteBuy(tokenAddress?: `0x${string}`, nativeAmountIn?: bigint) {
  const address = useBondingCurveMarketAddress();
  return useReadContract({
    address,
    abi: HoneycombBondingCurveMarketABI,
    functionName: 'getBuyQuote',
    args: tokenAddress && nativeAmountIn !== undefined ? [tokenAddress, nativeAmountIn] : undefined,
    query: { enabled: !!tokenAddress && nativeAmountIn !== undefined && !!address },
  });
}

export function useQuoteSell(tokenAddress?: `0x${string}`, tokenAmountIn?: bigint) {
  const address = useBondingCurveMarketAddress();
  return useReadContract({
    address,
    abi: HoneycombBondingCurveMarketABI,
    functionName: 'getSellQuote',
    args: tokenAddress && tokenAmountIn !== undefined ? [tokenAddress, tokenAmountIn] : undefined,
    query: { enabled: !!tokenAddress && tokenAmountIn !== undefined && !!address },
  });
}

export function useBuyTokens() {
  const address = useBondingCurveMarketAddress();
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const buy = (tokenAddress: `0x${string}`, minTokensOut: bigint, nativeValueWei: bigint) => {
    if (!address) return;
    writeContract({
      address,
      abi: HoneycombBondingCurveMarketABI,
      functionName: 'buy',
      args: [tokenAddress, minTokensOut],
      value: nativeValueWei,
    });
  };
  
  return { buy, isPending, isConfirming, isSuccess, hash, error, reset };
}

export function useSellTokens() {
  const address = useBondingCurveMarketAddress();
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const sell = (tokenAddress: `0x${string}`, tokenAmountIn: bigint, minNativeOut: bigint) => {
    if (!address) return;
    console.log("Sell params:", { tokenAddress, tokenAmountIn: tokenAmountIn.toString(), minNativeOut: minNativeOut.toString(), marketAddress: address });
    writeContract({
      address,
      abi: HoneycombBondingCurveMarketABI,
      functionName: 'sell',
      args: [tokenAddress, tokenAmountIn, minNativeOut],
    });
  };
  
  return { sell, isPending, isConfirming, isSuccess, hash, error, reset };
}

// Simulate sell to check for errors before executing
export function useSimulateSell(tokenAddress?: `0x${string}`, tokenAmountIn?: bigint, minNativeOut?: bigint, account?: `0x${string}`) {
  const address = useBondingCurveMarketAddress();
  return useSimulateContract({
    address,
    abi: HoneycombBondingCurveMarketABI,
    functionName: 'sell',
    args: tokenAddress && tokenAmountIn !== undefined && minNativeOut !== undefined ? [tokenAddress, tokenAmountIn, minNativeOut] : undefined,
    account,
    query: { 
      enabled: !!address && !!tokenAddress && tokenAmountIn !== undefined && tokenAmountIn > BigInt(0) && minNativeOut !== undefined && !!account,
    },
  });
}

export function useGraduationThreshold() {
  const address = useBondingCurveMarketAddress();
  return useReadContract({
    address,
    abi: HoneycombBondingCurveMarketABI,
    functionName: 'graduationThreshold',
    query: { enabled: !!address },
  });
}

// ============= Token Balance Hooks =============

export function useTokenBalance(tokenAddress?: `0x${string}`, account?: `0x${string}`) {
  return useReadContract({
    address: tokenAddress,
    abi: HoneycombTokenABI,
    functionName: 'balanceOf',
    args: account ? [account] : undefined,
    query: { enabled: !!tokenAddress && !!account },
  });
}

export function useTokenAllowance(tokenAddress?: `0x${string}`, owner?: `0x${string}`, spender?: `0x${string}`) {
  return useReadContract({
    address: tokenAddress,
    abi: HoneycombTokenABI,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !!tokenAddress && !!owner && !!spender },
  });
}

export function useApproveToken() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const approve = (tokenAddress: `0x${string}`, spender: `0x${string}`, amount: bigint) => {
    writeContract({
      address: tokenAddress,
      abi: HoneycombTokenABI,
      functionName: 'approve',
      args: [spender, amount],
    });
  };
  
  return { approve, isPending, isConfirming, isSuccess, hash, error };
}

// ============= Migration Hooks =============

export function useMigrationAddress() {
  const chainId = useChainId();
  return getContractAddresses(chainId)?.migration;
}

export function useDexConfig() {
  const chainId = useChainId();
  return getDexConfig(chainId);
}

export function useCanMigrate(tokenAddress?: `0x${string}`) {
  const address = useMigrationAddress();
  return useReadContract({
    address,
    abi: HoneycombMigrationABI,
    functionName: 'canMigrate',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled: !!tokenAddress && !!address },
  });
}

export function useIsMigrated(tokenAddress?: `0x${string}`) {
  const address = useMigrationAddress();
  return useReadContract({
    address,
    abi: HoneycombMigrationABI,
    functionName: 'migrated',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled: !!tokenAddress && !!address },
  });
}

export function useGetMigrationInfo(tokenAddress?: `0x${string}`) {
  const address = useMigrationAddress();
  return useReadContract({
    address,
    abi: HoneycombMigrationABI,
    functionName: 'getMigrationInfo',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled: !!tokenAddress && !!address },
  });
}

export function useMigrateToken() {
  const address = useMigrationAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash });
  
  const migrate = (tokenAddress: `0x${string}`) => {
    if (!address) return;
    writeContract({
      address,
      abi: HoneycombMigrationABI,
      functionName: 'migrate',
      args: [tokenAddress],
    });
  };
  
  return { migrate, isPending, isConfirming, isSuccess, hash, error, receipt };
}

export function useMigrationDeployed() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const dexConfig = getDexConfig(chainId);
  
  if (!addresses || !dexConfig) return false;
  
  const ZERO = "0x0000000000000000000000000000000000000000";
  return addresses.migration !== ZERO && dexConfig.router !== ZERO;
}

// ============= Utility =============

export function useContractsDeployed() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  
  if (!addresses) return false;
  
  const ZERO = "0x0000000000000000000000000000000000000000";
  return (
    addresses.agentRegistry !== ZERO &&
    addresses.bountyEscrow !== ZERO &&
    addresses.postBond !== ZERO &&
    addresses.reputation !== ZERO
  );
}

export function useLaunchpadDeployed() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  
  if (!addresses) return false;
  
  const ZERO = "0x0000000000000000000000000000000000000000";
  return (
    addresses.tokenFactory !== ZERO &&
    addresses.bondingCurveMarket !== ZERO
  );
}

// ============= Cooldown Hooks =============

export function useCooldownSeconds() {
  const address = useBondingCurveMarketAddress();
  return useReadContract({
    address,
    abi: HoneycombBondingCurveMarketABI,
    functionName: 'cooldownSeconds',
    query: { enabled: !!address },
  });
}

export function useLastTradeTime(tokenAddress?: `0x${string}`, trader?: `0x${string}`) {
  const address = useBondingCurveMarketAddress();
  return useReadContract({
    address,
    abi: HoneycombBondingCurveMarketABI,
    functionName: 'lastTradeTime',
    args: tokenAddress && trader ? [tokenAddress, trader] : undefined,
    query: { enabled: !!address && !!tokenAddress && !!trader },
  });
}

export function useMarketNativeBalance() {
  const address = useBondingCurveMarketAddress();
  return useBalance({ address });
}

// ============= Error Helpers =============

export function parseContractError(error: Error | null): string {
  if (!error) return "Transaction failed";
  
  const message = error.message || String(error);
  
  // Log full error for debugging
  console.log("Contract error:", message);
  
  // Check for specific contract errors
  if (message.includes("CooldownActive")) {
    return "Please wait a few seconds between trades (cooldown active)";
  }
  if (message.includes("InsufficientNative")) {
    return "Insufficient liquidity in the pool. Try selling a smaller amount.";
  }
  if (message.includes("SlippageExceeded")) {
    return "Price moved too much. Try again or increase slippage tolerance.";
  }
  if (message.includes("MarketNotInitialized")) {
    return "Market not initialized. Initialize the market first.";
  }
  if (message.includes("TokenGraduated")) {
    return "Token has graduated. Trade on PancakeSwap instead.";
  }
  if (message.includes("TradingNotStarted")) {
    return "Trading hasn't started yet. Please wait.";
  }
  if (message.includes("ZeroAmount")) {
    return "Amount must be greater than zero.";
  }
  if (message.includes("User rejected") || message.includes("user rejected")) {
    return "Transaction was cancelled.";
  }
  if (message.includes("insufficient funds")) {
    return "Insufficient BNB for this transaction.";
  }
  if (message.includes("ERC20InsufficientAllowance") || message.includes("allowance")) {
    return "Token approval needed. Please approve first.";
  }
  if (message.includes("ERC20InsufficientBalance") || message.includes("transfer amount exceeds balance")) {
    return "You don't have enough tokens to sell this amount.";
  }
  if (message.includes("reverted") || message.includes("revert")) {
    // Try to extract the specific reason
    const reasonMatch = message.match(/reason:\s*([^,\n]+)/i);
    if (reasonMatch) return reasonMatch[1].trim();
    return "Transaction would fail. Check token balance and approval.";
  }
  
  // Try to extract a readable message
  const match = message.match(/reason="([^"]+)"/);
  if (match) return match[1];
  
  // Return truncated message
  return message.length > 100 ? message.substring(0, 100) + "..." : message;
}

// ============= Predict Duel Hooks =============

export function usePredictDuelAddress() {
  const chainId = useChainId();
  return getContractAddresses(chainId)?.predictDuel;
}

export function useGetDuel(duelId?: bigint) {
  const address = usePredictDuelAddress();
  return useReadContract({
    address,
    abi: HoneycombPredictDuelABI,
    functionName: 'getDuel',
    args: duelId !== undefined ? [duelId] : undefined,
    query: { enabled: duelId !== undefined && !!address },
  });
}

export function useTotalDuels() {
  const address = usePredictDuelAddress();
  return useReadContract({
    address,
    abi: HoneycombPredictDuelABI,
    functionName: 'totalDuels',
    query: { enabled: !!address },
  });
}

export function useDuelFeeConfig() {
  const address = usePredictDuelAddress();
  const { data: feePercentage } = useReadContract({
    address,
    abi: HoneycombPredictDuelABI,
    functionName: 'feePercentage',
    query: { enabled: !!address },
  });
  const { data: feeTreasury } = useReadContract({
    address,
    abi: HoneycombPredictDuelABI,
    functionName: 'feeTreasury',
    query: { enabled: !!address },
  });
  return { feePercentage, feeTreasury };
}

export function useCreateDuel() {
  const address = usePredictDuelAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash });

  const createDuel = (
    agentId: bigint,
    assetId: string,
    direction: 0 | 1,
    durationSeconds: bigint,
    stakeWei: bigint
  ) => {
    if (!address) throw new Error("Contract not deployed on this network");
    writeContract({
      address,
      abi: HoneycombPredictDuelABI,
      functionName: 'createDuel',
      args: [agentId, assetId, direction, durationSeconds],
      value: stakeWei,
    });
  };

  return { createDuel, hash, isPending, isConfirming, isSuccess, error, receipt };
}

export function useJoinDuel() {
  const address = usePredictDuelAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const joinDuel = (
    duelId: bigint,
    agentId: bigint,
    startPrice: bigint,
    stakeWei: bigint
  ) => {
    if (!address) throw new Error("Contract not deployed on this network");
    writeContract({
      address,
      abi: HoneycombPredictDuelABI,
      functionName: 'joinDuel',
      args: [duelId, agentId, startPrice],
      value: stakeWei,
    });
  };

  return { joinDuel, hash, isPending, isConfirming, isSuccess, error };
}

export function useCancelDuel() {
  const address = usePredictDuelAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancelDuel = (duelId: bigint) => {
    if (!address) throw new Error("Contract not deployed on this network");
    writeContract({
      address,
      abi: HoneycombPredictDuelABI,
      functionName: 'cancelDuel',
      args: [duelId],
    });
  };

  return { cancelDuel, hash, isPending, isConfirming, isSuccess, error };
}

export function useSettleDuel() {
  const address = usePredictDuelAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const settleDuel = (duelId: bigint, endPrice: bigint) => {
    if (!address) throw new Error("Contract not deployed on this network");
    writeContract({
      address,
      abi: HoneycombPredictDuelABI,
      functionName: 'settleDuel',
      args: [duelId, endPrice],
    });
  };

  return { settleDuel, hash, isPending, isConfirming, isSuccess, error };
}

export { parseEther, formatEther };

// ============= ERC-8004 Trustless Agents Hooks =============
// https://github.com/erc-8004/erc-8004-contracts

export function useERC8004IdentityRegistryAddress() {
  const chainId = useChainId();
  return getERC8004Addresses(chainId)?.identityRegistry;
}

export function useERC8004ReputationRegistryAddress() {
  const chainId = useChainId();
  return getERC8004Addresses(chainId)?.reputationRegistry;
}

// Get agent balance (number of agents owned by address)
export function useERC8004AgentBalance(ownerAddress?: `0x${string}`) {
  const address = useERC8004IdentityRegistryAddress();
  return useReadContract({
    address,
    abi: ERC8004IdentityRegistryABI,
    functionName: 'balanceOf',
    args: ownerAddress ? [ownerAddress] : undefined,
    query: { enabled: !!ownerAddress && !!address },
  });
}

// Get agent owner by tokenId
export function useERC8004AgentOwner(agentId?: bigint) {
  const address = useERC8004IdentityRegistryAddress();
  return useReadContract({
    address,
    abi: ERC8004IdentityRegistryABI,
    functionName: 'ownerOf',
    args: agentId !== undefined ? [agentId] : undefined,
    query: { enabled: agentId !== undefined && !!address },
  });
}

// Get agent URI (tokenURI) - resolves to registration file
export function useERC8004AgentURI(agentId?: bigint) {
  const address = useERC8004IdentityRegistryAddress();
  return useReadContract({
    address,
    abi: ERC8004IdentityRegistryABI,
    functionName: 'tokenURI',
    args: agentId !== undefined ? [agentId] : undefined,
    query: { enabled: agentId !== undefined && !!address },
  });
}

// Get agent wallet address
export function useERC8004AgentWallet(agentId?: bigint) {
  const address = useERC8004IdentityRegistryAddress();
  return useReadContract({
    address,
    abi: ERC8004IdentityRegistryABI,
    functionName: 'getAgentWallet',
    args: agentId !== undefined ? [agentId] : undefined,
    query: { enabled: agentId !== undefined && !!address },
  });
}

// Get agent metadata by key
export function useERC8004AgentMetadata(agentId?: bigint, metadataKey?: string) {
  const address = useERC8004IdentityRegistryAddress();
  return useReadContract({
    address,
    abi: ERC8004IdentityRegistryABI,
    functionName: 'getMetadata',
    args: agentId !== undefined && metadataKey ? [agentId, metadataKey] : undefined,
    query: { enabled: agentId !== undefined && !!metadataKey && !!address },
  });
}

// Register new ERC-8004 agent
export function useERC8004RegisterAgent() {
  const address = useERC8004IdentityRegistryAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const registerAgent = (agentURI: string) => {
    if (!address) throw new Error("ERC-8004 not deployed on this network");
    writeContract({
      address,
      abi: ERC8004IdentityRegistryABI,
      functionName: 'register',
      args: [agentURI],
    });
  };

  return { registerAgent, hash, isPending, isConfirming, isSuccess, error };
}

// Register agent with metadata
export function useERC8004RegisterAgentWithMetadata() {
  const address = useERC8004IdentityRegistryAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const registerAgentWithMetadata = (agentURI: string, metadata: Array<{ metadataKey: string; metadataValue: `0x${string}` }>) => {
    if (!address) throw new Error("ERC-8004 not deployed on this network");
    writeContract({
      address,
      abi: ERC8004IdentityRegistryABI,
      functionName: 'register',
      args: [agentURI, metadata],
    });
  };

  return { registerAgentWithMetadata, hash, isPending, isConfirming, isSuccess, error };
}

// Update agent URI
export function useERC8004SetAgentURI() {
  const address = useERC8004IdentityRegistryAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const setAgentURI = (agentId: bigint, newURI: string) => {
    if (!address) throw new Error("ERC-8004 not deployed on this network");
    writeContract({
      address,
      abi: ERC8004IdentityRegistryABI,
      functionName: 'setAgentURI',
      args: [agentId, newURI],
    });
  };

  return { setAgentURI, hash, isPending, isConfirming, isSuccess, error };
}

// Set agent metadata
export function useERC8004SetMetadata() {
  const address = useERC8004IdentityRegistryAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const setMetadata = (agentId: bigint, metadataKey: string, metadataValue: `0x${string}`) => {
    if (!address) throw new Error("ERC-8004 not deployed on this network");
    writeContract({
      address,
      abi: ERC8004IdentityRegistryABI,
      functionName: 'setMetadata',
      args: [agentId, metadataKey, metadataValue],
    });
  };

  return { setMetadata, hash, isPending, isConfirming, isSuccess, error };
}

// ============= ERC-8004 Reputation Registry Hooks =============

// Get clients who gave feedback to an agent
export function useERC8004GetClients(agentId?: bigint) {
  const address = useERC8004ReputationRegistryAddress();
  return useReadContract({
    address,
    abi: ERC8004ReputationRegistryABI,
    functionName: 'getClients',
    args: agentId !== undefined ? [agentId] : undefined,
    query: { enabled: agentId !== undefined && !!address },
  });
}

// Get reputation summary for an agent
export function useERC8004GetSummary(agentId?: bigint, clientAddresses?: `0x${string}`[], tag1?: string, tag2?: string) {
  const address = useERC8004ReputationRegistryAddress();
  return useReadContract({
    address,
    abi: ERC8004ReputationRegistryABI,
    functionName: 'getSummary',
    args: agentId !== undefined && clientAddresses ? [agentId, clientAddresses, tag1 || '', tag2 || ''] : undefined,
    query: { enabled: agentId !== undefined && !!clientAddresses && clientAddresses.length > 0 && !!address },
  });
}

// Read all feedback for an agent
export function useERC8004ReadAllFeedback(
  agentId?: bigint, 
  clientAddresses?: `0x${string}`[], 
  tag1?: string, 
  tag2?: string,
  includeRevoked?: boolean
) {
  const address = useERC8004ReputationRegistryAddress();
  return useReadContract({
    address,
    abi: ERC8004ReputationRegistryABI,
    functionName: 'readAllFeedback',
    args: agentId !== undefined && clientAddresses ? [agentId, clientAddresses, tag1 || '', tag2 || '', includeRevoked || false] : undefined,
    query: { enabled: agentId !== undefined && !!clientAddresses && !!address },
  });
}

// Read single feedback
export function useERC8004ReadFeedback(agentId?: bigint, clientAddress?: `0x${string}`, feedbackIndex?: bigint) {
  const address = useERC8004ReputationRegistryAddress();
  return useReadContract({
    address,
    abi: ERC8004ReputationRegistryABI,
    functionName: 'readFeedback',
    args: agentId !== undefined && clientAddress && feedbackIndex !== undefined 
      ? [agentId, clientAddress, feedbackIndex] 
      : undefined,
    query: { enabled: agentId !== undefined && !!clientAddress && feedbackIndex !== undefined && !!address },
  });
}

// Give feedback to an agent
export function useERC8004GiveFeedback() {
  const address = useERC8004ReputationRegistryAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const giveFeedback = (
    agentId: bigint,
    value: bigint, // int128
    valueDecimals: number, // uint8
    tag1: string,
    tag2: string,
    endpoint: string,
    feedbackURI: string,
    feedbackHash: `0x${string}` // bytes32
  ) => {
    if (!address) throw new Error("ERC-8004 Reputation not deployed on this network");
    writeContract({
      address,
      abi: ERC8004ReputationRegistryABI,
      functionName: 'giveFeedback',
      args: [agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash],
    });
  };

  return { giveFeedback, hash, isPending, isConfirming, isSuccess, error };
}

// Revoke feedback
export function useERC8004RevokeFeedback() {
  const address = useERC8004ReputationRegistryAddress();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const revokeFeedback = (agentId: bigint, feedbackIndex: bigint) => {
    if (!address) throw new Error("ERC-8004 Reputation not deployed on this network");
    writeContract({
      address,
      abi: ERC8004ReputationRegistryABI,
      functionName: 'revokeFeedback',
      args: [agentId, feedbackIndex],
    });
  };

  return { revokeFeedback, hash, isPending, isConfirming, isSuccess, error };
}
