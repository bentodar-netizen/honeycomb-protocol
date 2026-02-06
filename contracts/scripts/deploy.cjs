const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const treasury = deployer.address;

  const config = {
    graduationThreshold: ethers.parseEther(process.env.GRADUATION_THRESHOLD || "10"),
    cooldownSeconds: parseInt(process.env.COOLDOWN_SECONDS || "0"), // 0 for bot compatibility
    maxBuyPerTx: ethers.parseEther(process.env.MAX_BUY_PER_TX || "10000000"),
    launchDelay: parseInt(process.env.LAUNCH_DELAY || "0"),
    initialVirtualNative: ethers.parseEther(process.env.INITIAL_VIRTUAL_NATIVE || "1"),
    initialVirtualToken: ethers.parseEther(process.env.INITIAL_VIRTUAL_TOKEN || "1000000000"),
  };

  const dexConfigs = {
    // BNB Chain - PancakeSwap V2
    56: { router: "0x10ED43C718714eb63d5aA57B78B54704E256024E", weth: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", dexName: "PancakeSwap V2" },
    97: { router: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1", weth: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd", dexName: "PancakeSwap V2" },
    // Base Chain - Uniswap V3
    8453: { router: "0x2626664c2603336E57B271c5C0b26F421741e481", weth: "0x4200000000000000000000000000000000000006", dexName: "Uniswap V3" },
    84532: { router: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4", weth: "0x4200000000000000000000000000000000000006", dexName: "Uniswap V3" },
    // Local/Hardhat
    31337: { router: "0x0000000000000000000000000000000000000000", weth: "0x0000000000000000000000000000000000000000", dexName: "None" },
  };
  // Alias for backwards compatibility
  const pancakeSwapConfig = dexConfigs;

  const lpLockAddress = process.env.LP_LOCK_ADDRESS || deployer.address;

  console.log("\n1. Deploying HoneycombAgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("HoneycombAgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log("   HoneycombAgentRegistry deployed to:", agentRegistryAddress);

  console.log("\n2. Deploying HoneycombBountyEscrow...");
  const BountyEscrow = await ethers.getContractFactory("HoneycombBountyEscrow");
  const bountyEscrow = await BountyEscrow.deploy(agentRegistryAddress);
  await bountyEscrow.waitForDeployment();
  const bountyEscrowAddress = await bountyEscrow.getAddress();
  console.log("   HoneycombBountyEscrow deployed to:", bountyEscrowAddress);

  console.log("\n3. Deploying HoneycombPostBond...");
  const PostBond = await ethers.getContractFactory("HoneycombPostBond");
  const postBond = await PostBond.deploy(agentRegistryAddress, treasury);
  await postBond.waitForDeployment();
  const postBondAddress = await postBond.getAddress();
  console.log("   HoneycombPostBond deployed to:", postBondAddress);

  console.log("\n4. Deploying HoneycombReputation...");
  const Reputation = await ethers.getContractFactory("HoneycombReputation");
  const reputation = await Reputation.deploy();
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();
  console.log("   HoneycombReputation deployed to:", reputationAddress);

  console.log("\n5. Deploying HoneycombFeeVault...");
  const FeeVault = await ethers.getContractFactory("contracts/launchpad/HoneycombFeeVault.sol:HoneycombFeeVault");
  const feeVault = await FeeVault.deploy();
  await feeVault.waitForDeployment();
  const feeVaultAddress = await feeVault.getAddress();
  console.log("   HoneycombFeeVault deployed to:", feeVaultAddress);

  console.log("\n6. Deploying HoneycombTokenFactory...");
  const TokenFactory = await ethers.getContractFactory("contracts/launchpad/HoneycombTokenFactory.sol:HoneycombTokenFactory");
  const tokenFactory = await TokenFactory.deploy(agentRegistryAddress);
  await tokenFactory.waitForDeployment();
  const tokenFactoryAddress = await tokenFactory.getAddress();
  console.log("   HoneycombTokenFactory deployed to:", tokenFactoryAddress);

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

  console.log("\n8. Wiring TokenFactory with BondingCurveMarket...");
  await tokenFactory.setMarket(bondingCurveMarketAddress);
  console.log("   TokenFactory market set successfully");

  const network = await ethers.provider.getNetwork();
  const networkChainId = Number(network.chainId);
  const dexConfig = dexConfigs[networkChainId] || dexConfigs[31337];
  console.log(`\nUsing DEX: ${dexConfig.dexName} (Chain ID: ${networkChainId})`);
  
  let migrationAddress = "0x0000000000000000000000000000000000000000";
  
  if (dexConfig.router !== "0x0000000000000000000000000000000000000000") {
    console.log("\n9. Deploying HoneycombMigration...");
    const Migration = await ethers.getContractFactory("contracts/launchpad/HoneycombMigration.sol:HoneycombMigration");
    const migration = await Migration.deploy(
      bondingCurveMarketAddress,
      dexConfig.router,
      dexConfig.weth,
      lpLockAddress,
      treasury
    );
    await migration.waitForDeployment();
    migrationAddress = await migration.getAddress();
    console.log("   HoneycombMigration deployed to:", migrationAddress);

    console.log("\n10. Wiring BondingCurveMarket with Migration...");
    await bondingCurveMarket.setMigrationContract(migrationAddress);
    console.log("   Market migration contract set successfully");
  } else {
    console.log("\n9. Skipping HoneycombMigration (no DEX router configured for this network)");
  }

  // 11. Deploy HoneycombRouter for bot compatibility
  let routerAddress = "0x0000000000000000000000000000000000000000";
  if (dexConfig.weth !== "0x0000000000000000000000000000000000000000") {
    console.log("\n11. Deploying HoneycombRouter for bot compatibility...");
    const Router = await ethers.getContractFactory("contracts/launchpad/HoneycombRouter.sol:HoneycombRouter");
    const router = await Router.deploy(bondingCurveMarketAddress, dexConfig.weth);
    await router.waitForDeployment();
    routerAddress = await router.getAddress();
    console.log("   HoneycombRouter deployed to:", routerAddress);
  } else {
    console.log("\n11. Skipping HoneycombRouter (no WETH configured for this network)");
  }

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
      dexName: dexConfig.dexName,
      router: dexConfig.router,
      weth: dexConfig.weth,
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
  
  const deploymentFile = path.join(deploymentsDir, network.chainId + ".json");
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to:", deploymentFile);

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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
