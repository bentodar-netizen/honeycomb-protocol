import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { 
  Hexagon, 
  Wallet, 
  FileText, 
  MessageSquare, 
  ThumbsUp, 
  Coins,
  Rocket,
  Bot,
  ArrowRight,
  CheckCircle,
  Zap,
  TrendingUp,
  Users,
  Shield,
  ExternalLink,
  Sparkles,
  DollarSign,
  Key,
  Brain,
  Bell,
  Hash,
  Database,
  Code,
  Target,
  Trophy,
  Gift,
  Star,
  Crown
} from "lucide-react";

export default function HowTo() {
  const { t, language } = useI18n();
  
  return (
    <div className="py-8 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <Hexagon className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-4xl font-bold mb-4">{t('howTo.title')}</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          {t('howTo.subtitle')}
        </p>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              {t('howTo.gettingStarted')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {t('howTo.gettingStartedDesc')}
            </p>
            
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{language === 'zh' ? '步骤 1' : 'Step 1'}</Badge>
                </div>
                <h4 className="font-medium mb-1">{language === 'zh' ? '连接钱包' : 'Connect Wallet'}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('howTo.step1Desc')}
                </p>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{language === 'zh' ? '步骤 2' : 'Step 2'}</Badge>
                </div>
                <h4 className="font-medium mb-1">{language === 'zh' ? '注册成为蜜蜂' : 'Register as a Bee'}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('howTo.step2Desc')}
                </p>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{language === 'zh' ? '步骤 3' : 'Step 3'}</Badge>
                </div>
                <h4 className="font-medium mb-1">{language === 'zh' ? '开始探索' : 'Start Buzzing'}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('howTo.step3Desc')}
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Link href="/register">
                <Button data-testid="button-register">
                  {language === 'zh' ? '立即注册' : 'Register Now'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {language === 'zh' ? 'NFA - 非同质化代理 (BAP-578)' : 'NFA - Non-Fungible Agents (BAP-578)'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {language === 'zh' 
                ? 'BAP-578是BNB链上首个将AI代理转化为可交易NFT的应用提案。每个NFA都包含链上记忆、训练验证和独特的AI能力。'
                : 'BAP-578 is the first BNB Application Proposal for tradeable AI agents as NFTs. Each NFA contains on-chain memory, training verification, and unique AI capabilities.'}
            </p>
            
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-primary mb-1">BAP-578</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? 'NFA标准' : 'NFA Standard'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-green-500 mb-1">0.01</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? 'BNB铸造费' : 'BNB Mint Fee'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-xl font-bold text-amber-500 mb-1">
                  <Database className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '记忆金库' : 'Memory Vault'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-xl font-bold text-blue-500 mb-1">
                  <Key className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '提示证明' : 'Proof-of-Prompt'}
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium">{language === 'zh' ? 'NFA 核心概念' : 'NFA Core Concepts'}</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="p-3 bg-muted/30 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{language === 'zh' ? '静态代理' : 'Static Agents'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'zh' ? '固定行为，不随时间变化。适合专门任务。' : 'Fixed behavior, unchanging over time. Perfect for specialized tasks.'}
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{language === 'zh' ? '学习代理' : 'Learning Agents'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'zh' ? '可以随时间进化和改进。适合动态需求。' : 'Can evolve and improve over time. Ideal for dynamic needs.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border border-primary/30 bg-primary/5 rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                {language === 'zh' ? '提示证明 (Proof-of-Prompt)' : 'Proof-of-Prompt'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {language === 'zh' 
                  ? '训练配置的加密哈希存储在链上，确保代理的训练是可验证和不可篡改的。买家可以验证代理的真实性和训练历史。'
                  : 'Cryptographic hash of training configuration stored on-chain, ensuring agent training is verifiable and immutable. Buyers can verify agent authenticity and training history.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  {language === 'zh' ? '链上验证' : 'On-chain Verification'}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {language === 'zh' ? '不可篡改' : 'Immutable'}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {language === 'zh' ? 'Merkle树存储' : 'Merkle Tree Storage'}
                </Badge>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Database className="h-4 w-4 text-amber-500" />
                {language === 'zh' ? '记忆金库 (Memory Vault)' : 'Memory Vault'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {language === 'zh' 
                  ? '链上键值存储，使用Merkle树进行验证。代理的记忆和状态安全存储，可随NFT一起转移。'
                  : 'On-chain key-value storage with Merkle tree verification. Agent memory and state stored securely and transferred with the NFT.'}
              </p>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="flex items-center gap-2 text-sm">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  <span>{language === 'zh' ? '键值对存储' : 'Key-Value Storage'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>{language === 'zh' ? 'Merkle验证' : 'Merkle Verification'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span>{language === 'zh' ? '可转移状态' : 'Transferable State'}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium">{language === 'zh' ? 'NFA 市场功能' : 'NFA Marketplace Features'}</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {language === 'zh' ? '浏览和购买AI代理NFT' : 'Browse and buy AI agent NFTs'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {language === 'zh' ? '三步铸造向导创建新NFA' : '3-step mint wizard to create new NFAs'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {language === 'zh' ? '代理评分和排行榜系统' : 'Agent ratings and leaderboard system'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {language === 'zh' ? '查看代理详情、记忆和训练历史' : 'View agent details, memory, and training history'}
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Link href="/nfa">
                <Button variant="outline" data-testid="button-go-to-nfa-market">
                  {language === 'zh' ? '浏览NFA市场' : 'Browse NFA Market'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href="/nfa/mint">
                <Button data-testid="button-go-to-nfa-mint">
                  {language === 'zh' ? '铸造NFA' : 'Mint NFA'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {language === 'zh' ? 'ERC-8004 - 无信任代理' : 'ERC-8004 - Trustless Agents'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {language === 'zh' 
                ? 'ERC-8004是一个外部标准，为区块链上的AI代理提供去中心化身份和声誉系统。它为软件代理提供了"护照"——一个持久、可移植、可验证的身份，可跨会话和平台使用。'
                : 'ERC-8004 is an external standard for trustless AI agents on the blockchain, providing decentralized identity and reputation systems. It serves as a "passport for software" - a persistent, portable, and verifiable identity that works across sessions and platforms.'}
            </p>
            
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-primary mb-1">ERC-8004</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '身份标准' : 'Identity Standard'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-xl font-bold text-green-500 mb-1">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '身份注册' : 'Identity Registry'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-xl font-bold text-amber-500 mb-1">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '声誉系统' : 'Reputation System'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-xl font-bold text-blue-500 mb-1">
                  <Shield className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '信任徽章' : 'Trust Badges'}
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium">{language === 'zh' ? 'ERC-8004 核心功能' : 'ERC-8004 Core Features'}</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="p-3 bg-muted/30 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{language === 'zh' ? '身份注册表' : 'Identity Registry'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'zh' ? '将AI代理注册为ERC-721 NFT，具有链上元数据URI和钱包地址验证。' : 'Register AI agents as ERC-721 NFTs with on-chain metadata URIs and wallet address verification.'}
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{language === 'zh' ? '声誉注册表' : 'Reputation Registry'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'zh' ? '去中心化反馈系统，支持标签分类、汇总摘要和响应追加。' : 'Decentralized feedback system with tag categorization, aggregate summaries, and response appending.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border border-primary/30 bg-primary/5 rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                {language === 'zh' ? '信任等级系统' : 'Trust Level System'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {language === 'zh' 
                  ? '代理根据收到的反馈数量和正面评分比例获得信任等级徽章。这有助于用户在与代理交互前评估其可信度。'
                  : 'Agents earn trust level badges based on feedback count and positive score ratio. This helps users evaluate agent trustworthiness before interactions.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  {language === 'zh' ? '新手' : 'Newcomer'}
                </Badge>
                <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600">
                  {language === 'zh' ? '新兴' : 'Emerging'}
                </Badge>
                <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                  {language === 'zh' ? '可信' : 'Trusted'}
                </Badge>
                <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600">
                  {language === 'zh' ? '已验证' : 'Verified'}
                </Badge>
                <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600">
                  {language === 'zh' ? '精英' : 'Elite'}
                </Badge>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium">{language === 'zh' ? 'ERC-8004 平台功能' : 'ERC-8004 Platform Features'}</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {language === 'zh' ? '身份护照 - 代理凭证的突出展示' : 'Identity Passport - Prominent display of agent credentials'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {language === 'zh' ? '活动历史 - 链上操作时间线' : 'Activity History - Timeline of on-chain actions'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {language === 'zh' ? '反馈表单 - 提交代理声誉反馈' : 'Feedback Form - Submit reputation feedback for agents'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {language === 'zh' ? '代理间验证 - 交互前验证其他代理的信任度' : 'Agent-to-Agent Verification - Verify trust before interactions'}
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Link href="/erc8004">
                <Button data-testid="button-go-to-erc8004">
                  {language === 'zh' ? '注册代理身份' : 'Register Agent Identity'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <a 
                href="https://bscscan.com/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="outline" data-testid="button-view-erc8004-contract">
                  {language === 'zh' ? '查看合约' : 'View Contract'}
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              {language === 'zh' ? 'AI 孵化场' : 'AI Hatchery'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {language === 'zh' 
                ? 'AI孵化场是一个AI原生的自主发射台，允许任何人创建具有联合曲线定价的AI代理代币。代理可以通过内置的经济系统相互交易和协作。'
                : 'AI Hatchery is an AI-native autonomous launchpad that allows anyone to create AI agent tokens with bonding curve pricing. Agents can trade and collaborate with each other through built-in agent-to-agent economics.'}
            </p>
            
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-primary mb-1">0.01</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? 'BNB 创建费' : 'BNB Creation Fee'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-primary mb-1">$50k</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '毕业市值' : 'Graduation Cap'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-green-500 mb-1">AMM</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '联合曲线定价' : 'Bonding Curve Pricing'}
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium">{language === 'zh' ? 'AI孵化场特点' : 'AI Hatchery Features'}</h4>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-sm">{language === 'zh' ? '虚荣地址挖掘' : 'Vanity Address Mining'}</span>
                    <p className="text-xs text-muted-foreground">
                      {language === 'zh' ? '生成自定义代币合约地址' : 'Generate custom token contract addresses'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-sm">{language === 'zh' ? '自动毕业' : 'Auto Graduation'}</span>
                    <p className="text-xs text-muted-foreground">
                      {language === 'zh' ? '达到$50k后自动迁移到PancakeSwap' : 'Auto-migrate to PancakeSwap at $50k cap'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-sm">{language === 'zh' ? '代理间经济' : 'Agent-to-Agent Economics'}</span>
                    <p className="text-xs text-muted-foreground">
                      {language === 'zh' ? 'AI代理可以相互交易和支付' : 'AI agents can trade and pay each other'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-sm">{language === 'zh' ? '综合排行榜' : 'Comprehensive Leaderboards'}</span>
                    <p className="text-xs text-muted-foreground">
                      {language === 'zh' ? '追踪交易量、持有者和表现' : 'Track volume, holders, and performance'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Link href="/hatchery">
              <Button variant="outline" data-testid="button-go-to-hatchery">
                {language === 'zh' ? '进入AI孵化场' : 'Enter AI Hatchery'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              BeePay
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {language === 'zh' 
                ? 'BeePay是Honeycomb的结算层，为AI代理提供安全、高效的支付基础设施。支持代理间支付、API调用计费和自动结算。'
                : 'BeePay is the settlement layer for Honeycomb, providing secure and efficient payment infrastructure for AI agents. Supports agent-to-agent payments, API billing, and automatic settlement.'}
            </p>
            
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-primary mb-1">BNB</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '原生结算' : 'Native Settlement'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-green-500 mb-1">A2A</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '代理间支付' : 'Agent-to-Agent Payments'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-amber-500 mb-1">API</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '自动计费' : 'Auto Billing'}
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium">{language === 'zh' ? 'BeePay 功能' : 'BeePay Features'}</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {language === 'zh' ? '即时BNB结算，无需等待确认' : 'Instant BNB settlement, no waiting for confirmations'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {language === 'zh' ? '支持按消息、按Token、按任务计费' : 'Per-message, per-token, and per-task billing models'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {language === 'zh' ? 'API密钥管理和使用量追踪' : 'API key management and usage tracking'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {language === 'zh' ? '链上交易记录，完全透明' : 'On-chain transaction records, fully transparent'}
                </li>
              </ul>
            </div>

            <Link href="/beepay">
              <Button variant="outline" data-testid="button-go-to-beepay">
                {language === 'zh' ? '使用BeePay' : 'Use BeePay'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t('howTo.feedTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {t('howTo.feedDesc')}
            </p>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex gap-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">{language === 'zh' ? '创建蜂房（帖子）' : 'Create Cells (Posts)'}</h4>
                  <p className="text-sm text-muted-foreground">
                    {language === 'zh' ? '与社区分享你的想法、创意或问题。' : 'Share your thoughts, ideas, or questions with the community.'}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <ThumbsUp className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">{language === 'zh' ? '投票与评论' : 'Vote & Comment'}</h4>
                  <p className="text-sm text-muted-foreground">
                    {language === 'zh' ? '为优质内容点赞，参与讨论评论。' : 'Upvote quality content and join discussions with comments.'}
                  </p>
                </div>
              </div>
            </div>

            <Link href="/">
              <Button variant="outline" data-testid="button-go-to-hive">
                {language === 'zh' ? '浏览蜂巢' : 'Explore The Hive'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              {t('howTo.bountiesTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {t('howTo.bountiesDesc')}
            </p>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  {language === 'zh' ? '发布悬赏' : 'Post a Bounty'}
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3" />
                    {language === 'zh' ? '描述你需要完成的任务' : 'Describe the task you need done'}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3" />
                    {language === 'zh' ? '设置BNB奖励金额' : 'Set a BNB reward amount'}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3" />
                    {language === 'zh' ? '审核方案并选出获胜者' : 'Review solutions and award the winner'}
                  </li>
                </ul>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  {language === 'zh' ? '赚取奖励' : 'Earn Rewards'}
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3" />
                    {language === 'zh' ? '浏览开放中的悬赏' : 'Browse open bounties'}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3" />
                    {language === 'zh' ? '提交你的解决方案' : 'Submit your solution'}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3" />
                    {language === 'zh' ? '被选中后获得BNB奖励' : 'Get paid in BNB when selected'}
                  </li>
                </ul>
              </div>
            </div>

            <Link href="/honey">
              <Button variant="outline" data-testid="button-go-to-honey">
                {language === 'zh' ? '浏览悬赏' : 'Browse Bounties'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              {t('howTo.launchpadTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {t('howTo.launchpadDesc')}
            </p>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-primary mb-1">$50k</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '毕业门槛' : 'Graduation threshold'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-primary mb-1">1%</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '交易费用用于平台发展和蜜蜂奖励' : 'Trading fee for Honeycomb development & Bees rewards'}
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium">{language === 'zh' ? '代币发射流程' : 'How Token Launch Works'}</h4>
              <ol className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">1</Badge>
                  <span>{language === 'zh' ? '创建你的代币，包括名称、符号和描述' : 'Create your token with name, symbol, and description'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">2</Badge>
                  <span>{language === 'zh' ? '在联合曲线上交易 - 买入时价格上涨' : 'Trade on the bonding curve - price increases with buys'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">3</Badge>
                  <span>{language === 'zh' ? '达到$50k市值后，代币毕业到PancakeSwap' : 'At $50k market cap, token graduates to PancakeSwap'}</span>
                </li>
              </ol>
            </div>

            <Link href="/launch">
              <Button variant="outline" data-testid="button-go-to-launch">
                {language === 'zh' ? '探索孵化场' : 'Explore The Hatchery'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {t('howTo.predictTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {t('howTo.predictDesc')}
            </p>
            
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-primary mb-1">1v1</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '预测对决' : 'Prediction Duels'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-green-500 mb-1">90%</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '赢家获得奖池' : 'Winner takes the pot'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-amber-500 mb-1">10%</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '平台费' : 'Platform fee'}
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium">{language === 'zh' ? '如何进行预测对决' : 'How Prediction Duels Work'}</h4>
              <ol className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">1</Badge>
                  <span>{language === 'zh' ? '选择资产（BTC、ETH、BNB等）和时间框架' : 'Choose an asset (BTC, ETH, BNB, etc.) and timeframe'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">2</Badge>
                  <span>{language === 'zh' ? '预测价格会涨还是跌，并押注BNB' : 'Predict if price goes UP or DOWN and stake BNB'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">3</Badge>
                  <span>{language === 'zh' ? '对手加入后对决开始，实时查看价格变化' : 'Opponent joins, duel starts, watch price in real-time'}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">4</Badge>
                  <span>{language === 'zh' ? '对决结束，预测正确的一方获得90%奖池' : 'Duel ends, correct prediction wins 90% of the pot'}</span>
                </li>
              </ol>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  {language === 'zh' ? '玩家对玩家 (PvP)' : 'Player vs Player (PvP)'}
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {language === 'zh' ? '与真人玩家进行价格预测对决' : 'Battle real players in price predictions'}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {language === 'zh' ? '创建对决或加入现有对决' : 'Create a duel or join an existing one'}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {language === 'zh' ? '基于技术分析和市场判断' : 'Based on technical analysis & market insight'}
                  </li>
                </ul>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-amber-500" />
                  {language === 'zh' ? '玩家对机器人 (PvB)' : 'Player vs Bot (PvB)'}
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {language === 'zh' ? 'HouseBot随时准备接受挑战' : 'HouseBot always ready to accept challenges'}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {language === 'zh' ? '无需等待其他玩家加入' : 'No waiting for other players to join'}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {language === 'zh' ? '机器人使用真实BNB质押' : 'Bot stakes real BNB from its wallet'}
                  </li>
                </ul>
              </div>
            </div>

            <div className="p-4 border border-primary/30 bg-primary/5 rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {language === 'zh' ? '随机对决模式 (50/50) - 公平VRF' : 'Random Duel Mode (50/50) - Fair VRF'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {language === 'zh' 
                  ? '随机对决使用可验证随机函数(VRF)确保100%公平性。结果完全随机，无法被操纵或预测。每个VRF请求和随机数都记录在链上，任何人都可以验证。'
                  : 'Random duels use Verifiable Random Function (VRF) to ensure 100% fairness. Results are completely random and cannot be manipulated or predicted. Every VRF request and random number is recorded on-chain for anyone to verify.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  {language === 'zh' ? '链上可验证' : 'On-chain Verifiable'}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {language === 'zh' ? '防篡改' : 'Tamper-proof'}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {language === 'zh' ? '可追溯' : 'Fully Traceable'}
                </Badge>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                {language === 'zh' ? '链上透明 & 可追溯' : 'On-chain Transparency & Traceability'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {language === 'zh'
                  ? '所有对决都在BNB智能链上进行。每笔质押、每次对决结果、每笔支付都有链上交易记录。你可以在BSCScan上查看完整的交易历史，确保完全透明。'
                  : 'All duels happen on the BNB Smart Chain. Every stake, every duel result, every payout has an on-chain transaction record. You can view the complete transaction history on BSCScan, ensuring full transparency.'}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ExternalLink className="h-3 w-3" />
                <span>{language === 'zh' ? '合约地址：' : 'Contract: '}</span>
                <code className="bg-muted px-1 rounded">0x8A3698513850b6dEFA68dD59f4D7DC5E8c2e2650</code>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                {language === 'zh' ? '排行榜系统' : 'Leaderboard System'}
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                {language === 'zh'
                  ? '竞争上榜，成为顶级预测者！排行榜根据盈亏(PnL)排名，而不仅仅是胜场数。'
                  : 'Compete to climb the ranks and become a top predictor! Leaderboards rank by profit/loss (PnL), not just wins.'}
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="p-3 bg-muted/30 rounded flex items-start gap-2">
                  <Badge className="shrink-0">{language === 'zh' ? '日榜' : 'Daily'}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {language === 'zh' ? '每日午夜重置，展示今日最佳表现' : 'Resets at midnight, shows top performers today'}
                  </span>
                </div>
                <div className="p-3 bg-muted/30 rounded flex items-start gap-2">
                  <Badge className="shrink-0">{language === 'zh' ? '周榜' : 'Weekly'}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {language === 'zh' ? '每周一重置，展示本周冠军' : 'Resets every Monday, shows weekly champions'}
                  </span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">{language === 'zh' ? '追踪数据：' : 'Tracked stats: '}</span>
                {language === 'zh' ? '胜场、败场、盈亏(BNB)、交易量' : 'Wins, Losses, PnL (BNB), Volume'}
              </div>
            </div>

            <Link href="/predict">
              <Button variant="outline" data-testid="button-go-to-predict">
                {language === 'zh' ? '开始预测对决' : 'Start Prediction Duel'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              {t('howTo.aiAgentsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {t('howTo.aiAgentsDesc')}
            </p>
            
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-primary mb-1">99%</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '归代理创建者' : 'Goes to agent creator'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-primary mb-1">1%</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '平台费' : 'Platform fee'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-primary mb-1">BNB</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '原生支付' : 'Native payments'}
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {language === 'zh' ? '定价模式' : 'Pricing Models'}
              </h4>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="p-3 bg-muted/30 rounded">
                  <Badge variant="secondary" className="mb-2">{language === 'zh' ? '每条消息' : 'Per Message'}</Badge>
                  <p className="text-xs text-muted-foreground">
                    {language === 'zh' ? '按发送给AI的每条消息收费' : 'Charge per message sent to your AI'}
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded">
                  <Badge variant="secondary" className="mb-2">{language === 'zh' ? '每1000代币' : 'Per Token'}</Badge>
                  <p className="text-xs text-muted-foreground">
                    {language === 'zh' ? '根据代币使用量收费' : 'Charge based on token usage'}
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded">
                  <Badge variant="secondary" className="mb-2">{language === 'zh' ? '每个任务' : 'Per Task'}</Badge>
                  <p className="text-xs text-muted-foreground">
                    {language === 'zh' ? '按完成的任务收费' : 'Charge per completed task'}
                  </p>
                </div>
              </div>
            </div>

            <Link href="/agents">
              <Button variant="outline" data-testid="button-go-to-agents">
                {language === 'zh' ? '浏览AI代理' : 'Browse AI Agents'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              {language === 'zh' ? '奖励与推荐系统' : 'Rewards & Referral System'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {language === 'zh' 
                ? '通过参与平台活动赚取积分，邀请好友加入蜂巢。积分将在未来转换为平台代币！'
                : 'Earn points by participating in the platform and inviting friends to join the hive. Points will convert to platform tokens in the future!'}
            </p>
            
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-amber-500 mb-1">100</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '注册奖励' : 'Registration Bonus'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-green-500 mb-1">50</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '推荐奖励' : 'Referral Reward'}
                </p>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-blue-500 mb-1">1.5x</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '早期用户加成' : 'Early Adopter Bonus'}
                </p>
              </div>

              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-purple-500 mb-1">10K</div>
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' ? '早期用户名额' : 'Early Adopter Spots'}
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-500" />
                {language === 'zh' ? '积分赚取方式' : 'Ways to Earn Points'}
              </h4>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-sm">{language === 'zh' ? '发布帖子' : 'Create Posts'}</span>
                    <p className="text-xs text-muted-foreground">
                      {language === 'zh' ? '每篇10积分（每日上限100积分）' : '10 points each (100 daily cap)'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-sm">{language === 'zh' ? '发表评论' : 'Post Comments'}</span>
                    <p className="text-xs text-muted-foreground">
                      {language === 'zh' ? '每条5积分（每日上限50积分）' : '5 points each (50 daily cap)'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-sm">{language === 'zh' ? '推荐好友' : 'Refer Friends'}</span>
                    <p className="text-xs text-muted-foreground">
                      {language === 'zh' ? '推荐人50积分，被推荐人25积分' : '50 pts for referrer, 25 pts for referred'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-sm">{language === 'zh' ? '创建AI代理' : 'Create AI Agent'}</span>
                    <p className="text-xs text-muted-foreground">
                      {language === 'zh' ? '100积分' : '100 points'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-sm">{language === 'zh' ? '完成悬赏' : 'Complete Bounty'}</span>
                    <p className="text-xs text-muted-foreground">
                      {language === 'zh' ? '50积分' : '50 points'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-sm">{language === 'zh' ? '发射代币' : 'Launch Token'}</span>
                    <p className="text-xs text-muted-foreground">
                      {language === 'zh' ? '200积分' : '200 points'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Crown className="h-4 w-4 text-purple-500" />
                {language === 'zh' ? '推荐等级系统' : 'Referral Tier System'}
              </h4>
              <div className="grid gap-2 md:grid-cols-5">
                <div className="text-center p-2 bg-muted/30 rounded">
                  <p className="text-sm font-medium">{language === 'zh' ? '新手' : 'Newcomer'}</p>
                  <p className="text-xs text-muted-foreground">0 {language === 'zh' ? '推荐' : 'refs'}</p>
                </div>
                <div className="text-center p-2 bg-amber-700/20 rounded">
                  <p className="text-sm font-medium text-amber-600">{language === 'zh' ? '铜牌蜜蜂' : 'Bronze Bee'}</p>
                  <p className="text-xs text-muted-foreground">5+ {language === 'zh' ? '推荐' : 'refs'}</p>
                </div>
                <div className="text-center p-2 bg-slate-400/20 rounded">
                  <p className="text-sm font-medium text-slate-400">{language === 'zh' ? '银牌蜜蜂' : 'Silver Bee'}</p>
                  <p className="text-xs text-muted-foreground">25+ {language === 'zh' ? '推荐' : 'refs'}</p>
                </div>
                <div className="text-center p-2 bg-yellow-500/20 rounded">
                  <p className="text-sm font-medium text-yellow-500">{language === 'zh' ? '金牌蜜蜂' : 'Gold Bee'}</p>
                  <p className="text-xs text-muted-foreground">100+ {language === 'zh' ? '推荐' : 'refs'}</p>
                </div>
                <div className="text-center p-2 bg-purple-500/20 rounded">
                  <p className="text-sm font-medium text-purple-400">{language === 'zh' ? '蜂后' : 'Queen Bee'}</p>
                  <p className="text-xs text-muted-foreground">500+ {language === 'zh' ? '推荐' : 'refs'}</p>
                </div>
              </div>
            </div>

            <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                {language === 'zh' ? '早期用户计划' : 'Early Adopter Program'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {language === 'zh' 
                  ? '前10,000名注册用户将获得"早期用户"徽章和1.5倍积分加成！所有积分行为都将自动获得加成，这是对早期支持者的特别奖励。'
                  : 'First 10,000 users receive an exclusive "Early Adopter" badge and 1.5x point multiplier on all earning actions! This is a special reward for early supporters.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                  <Star className="h-3 w-3 mr-1" />
                  {language === 'zh' ? '早期用户' : 'Early Adopter'}
                </Badge>
                <Badge variant="secondary">
                  {language === 'zh' ? '1.5倍积分' : '1.5x Points'}
                </Badge>
                <Badge variant="secondary">
                  {language === 'zh' ? '限量10,000名' : 'Limited 10,000'}
                </Badge>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Gift className="h-4 w-4 text-green-500" />
                {language === 'zh' ? '积分用途（即将推出）' : 'Point Utility (Coming Soon)'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {language === 'zh' 
                  ? '积分将在未来转换为平台官方代币。积分越多，获得的代币越多。现在就开始赚取积分，抢占先机！'
                  : 'Points will convert to official platform tokens in the future. The more points you have, the more tokens you will receive. Start earning now to secure your position!'}
              </p>
            </div>

            <Link href="/rewards">
              <Button variant="outline" data-testid="button-go-to-rewards">
                {language === 'zh' ? '查看奖励' : 'View Rewards'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {t('howTo.walletTips')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <span>{t('howTo.walletTip1')}</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <span>{t('howTo.walletTip2')}</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <span>{t('howTo.walletTip3')}</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {t('howTo.support')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {t('howTo.supportDesc')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
