import { ethers } from 'ethers';
import { storage } from './storage';
import type { AutonomousAgent, AgentTokenLaunch } from '@shared/schema';

const AGENT_CONTROLLER_ABI = [
  "function registerAgent(address executor, string metadataCID) returns (uint256)",
  "function launchToken(string name, string symbol, string metadataCID, string narrative, uint256 creatorBeeId, bytes32 salt) returns (address)",
  "function agentBuy(address token, uint256 minTokensOut) payable returns (uint256)",
  "function agentSell(address token, uint256 tokenAmount, uint256 minNativeOut) returns (uint256)",
  "function triggerGraduation(address token)",
  "function getAgent(uint256 agentId) view returns (tuple(uint256 id, address owner, address executor, string metadataCID, bool canDeployToken, bool canLaunch, bool canGraduate, bool canTrade, bool isActive, uint256 createdAt, uint256 totalTokensLaunched, uint256 totalTradesExecuted, uint256 totalGraduations))",
  "function canAgentGraduate(uint256 agentId, address token) view returns (bool)",
  "event TokenLaunched(uint256 indexed agentId, address indexed tokenAddress, string name, string symbol, string narrative, uint256 graduationTargetBnb, uint256 timestamp)",
  "event AgentTrade(uint256 indexed agentId, address indexed tokenAddress, bool isBuy, uint256 nativeAmount, uint256 tokenAmount, uint256 timestamp)",
  "event TokenGraduated(uint256 indexed agentId, address indexed tokenAddress, uint256 totalRaised, uint256 timestamp)"
];

const BONDING_CURVE_ABI = [
  "function markets(address token) view returns (uint256 nativeReserve, uint256 tokenReserve, uint256 totalRaisedNative, uint256 tradingStartTime, bool graduated, bool initialized)",
  "function graduationThreshold() view returns (uint256)",
  "function getBuyQuote(address token, uint256 nativeIn) view returns (uint256 tokensOut, uint256 fee)",
  "function getSellQuote(address token, uint256 tokenAmountIn) view returns (uint256 nativeOut, uint256 fee)"
];

interface AgentAction {
  type: 'launch' | 'buy' | 'sell' | 'graduate';
  agentId: string;
  params: Record<string, unknown>;
}

interface AgentRuntimeConfig {
  rpcUrl: string;
  agentControllerAddress: string;
  bondingCurveMarketAddress: string;
  checkIntervalMs: number;
  maxActionsPerRun: number;
}

export class AgentRuntime {
  private provider: ethers.JsonRpcProvider;
  private config: AgentRuntimeConfig;
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private agentWallets: Map<string, ethers.Wallet> = new Map();
  private pendingActions: AgentAction[] = [];

  constructor(config: AgentRuntimeConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[AgentRuntime] Already running');
      return;
    }

    console.log('[AgentRuntime] Starting autonomous agent runtime...');
    this.isRunning = true;

    this.checkInterval = setInterval(async () => {
      try {
        await this.runChecks();
      } catch (error) {
        console.error('[AgentRuntime] Error in check loop:', error);
      }
    }, this.config.checkIntervalMs);

    await this.runChecks();
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('[AgentRuntime] Stopped');
  }

  private async runChecks(): Promise<void> {
    console.log('[AgentRuntime] Running checks...');
    
    await this.checkGraduations();
    await this.processPendingActions();
  }

  private async checkGraduations(): Promise<void> {
    try {
      const launches = await storage.getAllAgentTokenLaunches(100, 'incubating');
      
      for (const launch of launches) {
        const isReady = await this.isReadyForGraduation(launch.tokenAddress);
        if (isReady) {
          console.log(`[AgentRuntime] Token ${launch.tokenAddress} ready for graduation`);
          
          await storage.updateAgentTokenLaunch(launch.tokenAddress, {
            status: 'ready_to_graduate'
          });
          
          this.pendingActions.push({
            type: 'graduate',
            agentId: launch.autonomousAgentId,
            params: { tokenAddress: launch.tokenAddress }
          });
        }
      }
    } catch (error) {
      console.error('[AgentRuntime] Error checking graduations:', error);
    }
  }

  private async isReadyForGraduation(tokenAddress: string): Promise<boolean> {
    try {
      const contract = new ethers.Contract(
        this.config.bondingCurveMarketAddress,
        BONDING_CURVE_ABI,
        this.provider
      );

      const [, , totalRaised, , graduated, initialized] = await contract.markets(tokenAddress);
      if (!initialized || graduated) return false;

      const threshold = await contract.graduationThreshold();
      return BigInt(totalRaised) >= BigInt(threshold);
    } catch (error) {
      console.error(`[AgentRuntime] Error checking graduation for ${tokenAddress}:`, error);
      return false;
    }
  }

  private async processPendingActions(): Promise<void> {
    const actionsToProcess = this.pendingActions.splice(0, this.config.maxActionsPerRun);
    
    for (const action of actionsToProcess) {
      try {
        await this.executeAction(action);
      } catch (error) {
        console.error(`[AgentRuntime] Error executing action:`, action, error);
      }
    }
  }

  private async executeAction(action: AgentAction): Promise<void> {
    const agent = await storage.getAutonomousAgent(action.agentId);
    if (!agent || !agent.isActive) {
      console.log(`[AgentRuntime] Agent ${action.agentId} not found or inactive`);
      return;
    }

    const wallet = this.getAgentWallet(agent);
    if (!wallet) {
      console.log(`[AgentRuntime] No wallet for agent ${action.agentId}`);
      return;
    }

    const controller = new ethers.Contract(
      this.config.agentControllerAddress,
      AGENT_CONTROLLER_ABI,
      wallet
    );

    switch (action.type) {
      case 'graduate':
        await this.executeGraduation(controller, action.params.tokenAddress as string, agent);
        break;
      case 'buy':
        await this.executeBuy(controller, action.params as { tokenAddress: string; amount: string; minOut: string }, agent);
        break;
      case 'sell':
        await this.executeSell(controller, action.params as { tokenAddress: string; tokenAmount: string; minOut: string }, agent);
        break;
      case 'launch':
        await this.executeLaunch(controller, action.params as {
          name: string;
          symbol: string;
          metadataCID: string;
          narrative: string;
          creatorBeeId: number;
          salt: string;
        }, agent);
        break;
    }
  }

  private async executeGraduation(
    controller: ethers.Contract,
    tokenAddress: string,
    agent: AutonomousAgent
  ): Promise<void> {
    console.log(`[AgentRuntime] Executing graduation for ${tokenAddress}`);
    
    try {
      const tx = await controller.triggerGraduation(tokenAddress);
      const receipt = await tx.wait();
      
      console.log(`[AgentRuntime] Graduation tx confirmed: ${receipt.hash}`);
      
      await storage.updateAgentTokenLaunch(tokenAddress, {
        status: 'graduated',
        graduatedAt: new Date(),
        graduateTxHash: receipt.hash
      });
      
      await storage.updateAutonomousAgent(agent.id, {
        totalGraduations: agent.totalGraduations + 1,
        lastActionAt: new Date()
      });
    } catch (error) {
      console.error(`[AgentRuntime] Graduation failed for ${tokenAddress}:`, error);
      await storage.updateAgentTokenLaunch(tokenAddress, {
        status: 'failed'
      });
    }
  }

  private async executeBuy(
    controller: ethers.Contract,
    params: { tokenAddress: string; amount: string; minOut: string },
    agent: AutonomousAgent
  ): Promise<void> {
    console.log(`[AgentRuntime] Executing buy for agent ${agent.id}`);
    
    try {
      const tx = await controller.agentBuy(
        params.tokenAddress,
        params.minOut,
        { value: params.amount }
      );
      const receipt = await tx.wait();
      
      console.log(`[AgentRuntime] Buy tx confirmed: ${receipt.hash}`);
      
      await storage.createAgentTrade({
        autonomousAgentId: agent.id,
        tokenAddress: params.tokenAddress,
        isBuy: true,
        nativeAmountWei: params.amount,
        tokenAmountWei: params.minOut,
        feeWei: '0',
        priceAfterWei: '0',
        txHash: receipt.hash
      });
      
      await storage.updateAutonomousAgent(agent.id, {
        totalTradesExecuted: agent.totalTradesExecuted + 1,
        totalVolumeWei: (BigInt(agent.totalVolumeWei) + BigInt(params.amount)).toString(),
        lastActionAt: new Date()
      });
    } catch (error) {
      console.error(`[AgentRuntime] Buy failed:`, error);
    }
  }

  private async executeSell(
    controller: ethers.Contract,
    params: { tokenAddress: string; tokenAmount: string; minOut: string },
    agent: AutonomousAgent
  ): Promise<void> {
    console.log(`[AgentRuntime] Executing sell for agent ${agent.id}`);
    
    try {
      const tx = await controller.agentSell(
        params.tokenAddress,
        params.tokenAmount,
        params.minOut
      );
      const receipt = await tx.wait();
      
      console.log(`[AgentRuntime] Sell tx confirmed: ${receipt.hash}`);
      
      await storage.createAgentTrade({
        autonomousAgentId: agent.id,
        tokenAddress: params.tokenAddress,
        isBuy: false,
        nativeAmountWei: params.minOut,
        tokenAmountWei: params.tokenAmount,
        feeWei: '0',
        priceAfterWei: '0',
        txHash: receipt.hash
      });
      
      await storage.updateAutonomousAgent(agent.id, {
        totalTradesExecuted: agent.totalTradesExecuted + 1,
        lastActionAt: new Date()
      });
    } catch (error) {
      console.error(`[AgentRuntime] Sell failed:`, error);
    }
  }

  private async executeLaunch(
    controller: ethers.Contract,
    params: {
      name: string;
      symbol: string;
      metadataCID: string;
      narrative: string;
      creatorBeeId: number;
      salt: string;
    },
    agent: AutonomousAgent
  ): Promise<void> {
    console.log(`[AgentRuntime] Executing token launch for agent ${agent.id}`);
    
    try {
      const tx = await controller.launchToken(
        params.name,
        params.symbol,
        params.metadataCID,
        params.narrative,
        params.creatorBeeId,
        params.salt
      );
      const receipt = await tx.wait();
      
      const tokenLaunchedEvent = receipt.logs.find((log: ethers.Log) => {
        try {
          const parsed = controller.interface.parseLog({ topics: [...log.topics], data: log.data });
          return parsed?.name === 'TokenLaunched';
        } catch {
          return false;
        }
      });
      
      let tokenAddress = '';
      if (tokenLaunchedEvent) {
        const parsed = controller.interface.parseLog({ 
          topics: [...tokenLaunchedEvent.topics], 
          data: tokenLaunchedEvent.data 
        });
        tokenAddress = parsed?.args?.tokenAddress || '';
      }
      
      console.log(`[AgentRuntime] Token launched: ${tokenAddress}, tx: ${receipt.hash}`);
      
      if (tokenAddress) {
        const bondingCurve = new ethers.Contract(
          this.config.bondingCurveMarketAddress,
          BONDING_CURVE_ABI,
          this.provider
        );
        const threshold = await bondingCurve.graduationThreshold();
        
        await storage.createAgentTokenLaunch({
          autonomousAgentId: agent.id,
          tokenAddress,
          tokenName: params.name,
          tokenSymbol: params.symbol,
          metadataCid: params.metadataCID,
          agentNarrative: params.narrative,
          graduationTargetBnb: threshold.toString()
        });
        
        await storage.updateAutonomousAgent(agent.id, {
          totalTokensLaunched: agent.totalTokensLaunched + 1,
          lastActionAt: new Date()
        });
      }
    } catch (error) {
      console.error(`[AgentRuntime] Launch failed:`, error);
    }
  }

  private getAgentWallet(agent: AutonomousAgent): ethers.Wallet | null {
    if (this.agentWallets.has(agent.id)) {
      return this.agentWallets.get(agent.id) || null;
    }
    return null;
  }

  registerAgentWallet(agentId: string, privateKey: string): void {
    const wallet = new ethers.Wallet(privateKey, this.provider);
    this.agentWallets.set(agentId, wallet);
    console.log(`[AgentRuntime] Registered wallet for agent ${agentId}`);
  }

  queueAction(action: AgentAction): void {
    this.pendingActions.push(action);
    console.log(`[AgentRuntime] Queued action: ${action.type} for agent ${action.agentId}`);
  }

  async getAgentStats(agentId: string): Promise<{
    tokensLaunched: number;
    graduations: number;
    trades: number;
    volume: string;
    pnl: string;
  }> {
    const agent = await storage.getAutonomousAgent(agentId);
    if (!agent) {
      return { tokensLaunched: 0, graduations: 0, trades: 0, volume: '0', pnl: '0' };
    }
    return {
      tokensLaunched: agent.totalTokensLaunched,
      graduations: agent.totalGraduations,
      trades: agent.totalTradesExecuted,
      volume: agent.totalVolumeWei,
      pnl: agent.totalPnlWei
    };
  }

  async getTokenStatus(tokenAddress: string): Promise<{
    isInitialized: boolean;
    isGraduated: boolean;
    totalRaised: string;
    threshold: string;
    progress: number;
  }> {
    try {
      const contract = new ethers.Contract(
        this.config.bondingCurveMarketAddress,
        BONDING_CURVE_ABI,
        this.provider
      );

      const [, , totalRaised, , graduated, initialized] = await contract.markets(tokenAddress);
      const threshold = await contract.graduationThreshold();

      const progress = Number(totalRaised) / Number(threshold) * 100;

      return {
        isInitialized: initialized,
        isGraduated: graduated,
        totalRaised: totalRaised.toString(),
        threshold: threshold.toString(),
        progress: Math.min(progress, 100)
      };
    } catch (error) {
      console.error(`[AgentRuntime] Error getting token status:`, error);
      return {
        isInitialized: false,
        isGraduated: false,
        totalRaised: '0',
        threshold: '0',
        progress: 0
      };
    }
  }
}

let agentRuntime: AgentRuntime | null = null;

export function getAgentRuntime(): AgentRuntime | null {
  return agentRuntime;
}

export function initAgentRuntime(config: AgentRuntimeConfig): AgentRuntime {
  if (agentRuntime) {
    agentRuntime.stop();
  }
  agentRuntime = new AgentRuntime(config);
  return agentRuntime;
}
