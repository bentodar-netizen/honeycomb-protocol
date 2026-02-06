import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Use deployer as treasury for now
  const treasury = deployer.address;

  // Configuration (can be overridden via env)
  const config = {
    graduationThreshold: ethers.parseEther(process.env.GRADUATION_THRESHOLD || "10"), // 10 BNB
    cooldownSeconds: parseInt(process.env.COOLDOWN_SECONDS || "10"),
    maxBuyPerTx: ethers.parseEther(process.env.MAX_BUY_PER_TX || "10000000"), // 1% of 1B = 10M tokens
    launchDelay: parseInt(process.env.LAUNCH_DELAY || "0"),
    initialVirtualNative: ethers.parseEther(process.env.INITIAL_VIRTUAL_NATIVE || "1"),
    initialVirtualToken: ethers.parseEther(process.env.INITIAL_VIRTUAL_TOKEN || "1000000000"), // 1B virtual tokens
  };

  // PancakeSwap addresses by network
  const pancakeSwapConfig: Record<number, { router: string; wbnb: string }> = {
    56: { // BSC Mainnet
      router: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
      wbnb: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    },
    97: { // BSC Testnet
      router: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
      wbnb: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    },
    31337: { // Hardhat local (use mock addresses, set after deployment)
      router: "0x0000000000000000000000000000000000000000",
      wbnb: "0x0000000000000000000000000000000000000000",
    },
  };

  // LP Lock address (use deployer for now, should be replaced with a proper lock contract)
  const lpLockAddress = process.env.LP_LOCK_ADDRESS || deployer.address;

  // 1. Deploy HoneycombAgentRegistry
  console.log("\n1. Deploying HoneycombAgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("HoneycombAgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log("   HoneycombAgentRegistry deployed to:", agentRegistryAddress);

  // 2. Deploy HoneycombBountyEscrow
  console.log("\n2. Deploying HoneycombBountyEscrow...");
  const BountyEscrow = await ethers.getContractFactory("HoneycombBountyEscrow");
  const bountyEscrow = await BountyEscrow.deploy(agentRegistryAddress);
  await bountyEscrow.waitForDeployment();
  const bountyEscrowAddress = await bountyEscrow.getAddress();
  console.log("   HoneycombBountyEscrow deployed to:", bountyEscrowAddress);

  // 3. Deploy HoneycombPostBond
  console.log("\n3. Deploying HoneycombPostBond...");
  const PostBond = await ethers.getContractFactory("HoneycombPostBond");
  const postBond = await PostBond.deploy(agentRegistryAddress, treasury);
  await postBond.waitForDeployment();
  const postBondAddress = await postBond.getAddress();
  console.log("   HoneycombPostBond deployed to:", postBondAddress);

  // 4. Deploy HoneycombReputation
  console.log("\n4. Deploying HoneycombReputation...");
  const Reputation = await ethers.getContractFactory("HoneycombReputation");
  const reputation = await Reputation.deploy();
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();
  console.log("   HoneycombReputation deployed to:", reputationAddress);

  // 5. Deploy HoneycombFeeVault
  console.log("\n5. Deploying HoneycombFeeVault...");
  const FeeVault = await ethers.getContractFactory("contracts/launchpad/HoneycombFeeVault.sol:HoneycombFeeVault");
  const feeVault = await FeeVault.deploy();
  await feeVault.waitForDeployment();
  const feeVaultAddress = await feeVault.getAddress();
  console.log("   HoneycombFeeVault deployed to:", feeVaultAddress);

  // 6. Deploy HoneycombTokenFactory
  console.log("\n6. Deploying HoneycombTokenFactory...");
  const TokenFactory = await ethers.getContractFactory("contracts/launchpad/HoneycombTokenFactory.sol:HoneycombTokenFactory");
  const tokenFactory = await TokenFactory.deploy(agentRegistryAddress);
  await tokenFactory.waitForDeployment();
  const tokenFactoryAddress = await tokenFactory.getAddress();
  console.log("   HoneycombTokenFactory deployed to:", tokenFactoryAddress);

  // 7. Deploy HoneycombBondingCurveMarket
  console.log("\n7. Deploying HoneycombBondingCurveMarket...");
  const BondingCurveMarket = await ethers.getContractFactory("contracts/launchpad/HoneycombBondingCurveMarket.sol:HoneycombBondingCurveMarket");
  const bondingCurveMarket = await BondingCurveMarket.deploy(
    tokenFactoryAddress,
    feeVaultAddress,
    config.graduationThreshold,
    config.cooldownSeconds,
    config.maxBuyPerTx,
    config.launchDelay,
    config.initialVirtualNative,
    config.initialVirtualToken
  );
  await bondingCurveMarket.waitForDeployment();
  const bondingCurveMarketAddress = await bondingCurveMarket.getAddress();
  console.log("   HoneycombBondingCurveMarket deployed to:", bondingCurveMarketAddress);

  // 8. Wire up Factory with Market
  console.log("\n8. Wiring TokenFactory with BondingCurveMarket...");
  await tokenFactory.setMarket(bondingCurveMarketAddress);
  console.log("   TokenFactory market set successfully");

  // Get network info for DEX config
  const network = await ethers.provider.getNetwork();
  const networkChainId = Number(network.chainId);
  const dexConfig = pancakeSwapConfig[networkChainId] || pancakeSwapConfig[31337];
  
  // 9. Deploy HoneycombMigration
  let migrationAddress = "0x0000000000000000000000000000000000000000";
  
  if (dexConfig.router !== "0x0000000000000000000000000000000000000000") {
    console.log("\n9. Deploying HoneycombMigration...");
    const Migration = await ethers.getContractFactory("contracts/launchpad/HoneycombMigration.sol:HoneycombMigration");
    const migration = await Migration.deploy(
      bondingCurveMarketAddress,
      dexConfig.router,
      dexConfig.wbnb,
      lpLockAddress,
      treasury
    );
    await migration.waitForDeployment();
    migrationAddress = await migration.getAddress();
    console.log("   HoneycombMigration deployed to:", migrationAddress);

    // 10. Wire up Market with Migration
    console.log("\n10. Wiring BondingCurveMarket with Migration...");
    await bondingCurveMarket.setMigrationContract(migrationAddress);
    console.log("   Market migration contract set successfully");
  } else {
    console.log("\n9. Skipping HoneycombMigration (no DEX router configured for this network)");
  }

  // 11. Deploy HoneycombRouter (for bot compatibility)
  let routerAddress = "0x0000000000000000000000000000000000000000";
  
  if (dexConfig.wbnb !== "0x0000000000000000000000000000000000000000") {
    console.log("\n11. Deploying HoneycombRouter (for bot compatibility)...");
    const Router = await ethers.getContractFactory("contracts/launchpad/HoneycombRouter.sol:HoneycombRouter");
    const router = await Router.deploy(
      bondingCurveMarketAddress,
      dexConfig.wbnb
    );
    await router.waitForDeployment();
    routerAddress = await router.getAddress();
    console.log("   HoneycombRouter deployed to:", routerAddress);
  } else {
    console.log("\n11. Skipping HoneycombRouter (no WBNB configured for this network)");
  }

  // Save deployment addresses
  const deploymentInfo = {
    chainId: Number(network.chainId),
    networkName: network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      HoneycombAgentRegistry: agentRegistryAddress,
      HoneycombBountyEscrow: bountyEscrowAddress,
      HoneycombPostBond: postBondAddress,
      HoneycombReputation: reputationAddress,
      HoneycombFeeVault: feeVaultAddress,
      HoneycombTokenFactory: tokenFactoryAddress,
      HoneycombBondingCurveMarket: bondingCurveMarketAddress,
      HoneycombMigration: migrationAddress,
      HoneycombRouter: routerAddress,
    },
    dexConfig: {
      router: dexConfig.router,
      wbnb: dexConfig.wbnb,
      lpLockAddress: lpLockAddress,
    },
    config: {
      graduationThreshold: config.graduationThreshold.toString(),
      cooldownSeconds: config.cooldownSeconds,
      maxBuyPerTx: config.maxBuyPerTx.toString(),
      launchDelay: config.launchDelay,
      initialVirtualNative: config.initialVirtualNative.toString(),
      initialVirtualToken: config.initialVirtualToken.toString(),
    },
  };

  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const deploymentFile = path.join(deploymentsDir, `${network.chainId}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${deploymentFile}`);

  console.log("\n✅ All contracts deployed successfully!");
  console.log("\nContract Addresses:");
  console.log("==================");
  console.log("HoneycombAgentRegistry:", agentRegistryAddress);
  console.log("HoneycombBountyEscrow:", bountyEscrowAddress);
  console.log("HoneycombPostBond:", postBondAddress);
  console.log("HoneycombReputation:", reputationAddress);
  console.log("HoneycombFeeVault:", feeVaultAddress);
  console.log("HoneycombTokenFactory:", tokenFactoryAddress);
  console.log("HoneycombBondingCurveMarket:", bondingCurveMarketAddress);
  console.log("HoneycombMigration:", migrationAddress);
  console.log("HoneycombRouter:", routerAddress);
  console.log("\nDEX Configuration:");
  console.log("==================");
  console.log("PancakeSwap Router:", dexConfig.router);
  console.log("WBNB:", dexConfig.wbnb);
  console.log("LP Lock Address:", lpLockAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
