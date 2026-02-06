import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying HoneycombPredictDuel with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const AGENT_REGISTRY_ADDRESS = process.env.AGENT_REGISTRY_ADDRESS || "";
  const FEE_TREASURY_ADDRESS = "0xEA42922A5c695bD947246988B7927fbD3fD889fF";

  if (!AGENT_REGISTRY_ADDRESS) {
    console.error("ERROR: Set AGENT_REGISTRY_ADDRESS environment variable");
    process.exit(1);
  }

  console.log("\nDeployment parameters:");
  console.log("- Agent Registry:", AGENT_REGISTRY_ADDRESS);
  console.log("- Fee Treasury:", FEE_TREASURY_ADDRESS);

  const HoneycombPredictDuel = await ethers.getContractFactory("HoneycombPredictDuel");
  const predictDuel = await HoneycombPredictDuel.deploy(
    AGENT_REGISTRY_ADDRESS,
    FEE_TREASURY_ADDRESS
  );

  await predictDuel.waitForDeployment();
  const contractAddress = await predictDuel.getAddress();

  console.log("\n✅ HoneycombPredictDuel deployed to:", contractAddress);
  console.log("\nNext steps:");
  console.log("1. Verify on BscScan:");
  console.log(`   npx hardhat verify --network bsc ${contractAddress} ${AGENT_REGISTRY_ADDRESS} ${FEE_TREASURY_ADDRESS}`);
  console.log("2. Grant ORACLE_ROLE to your backend wallet:");
  console.log(`   const ORACLE_ROLE = await predictDuel.ORACLE_ROLE();`);
  console.log(`   await predictDuel.grantRole(ORACLE_ROLE, BACKEND_WALLET_ADDRESS);`);
  console.log("3. Update frontend with contract address");

  return contractAddress;
}

main()
  .then((address) => {
    console.log("\nDeployment complete. Contract:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
