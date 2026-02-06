const fs = require("fs");
const path = require("path");

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const VERIFY_URL = "https://api.etherscan.io/v2/api?chainid=56";
const CHECK_URL = "https://api.etherscan.io/v2/api?chainid=56";

const deploymentPath = path.join(__dirname, "../deployments/56.json");
const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

const BUILD_INFO_DIR = path.join(__dirname, "../contracts/artifacts/build-info-verified");

const buildInfoFiles = {
  core: JSON.parse(fs.readFileSync(path.join(BUILD_INFO_DIR, "7f5d58b9f3222951c6702cd737fc9790.json"), "utf8")),
  launchpad_full: JSON.parse(fs.readFileSync(path.join(BUILD_INFO_DIR, "ce6d9b11199fdca103e8d41ba6f5e8eb.json"), "utf8")),
};

const contracts = [
  {
    name: "HoneycombAgentRegistry",
    address: deployment.contracts.HoneycombAgentRegistry,
    contractPath: "contracts/HoneycombAgentRegistry.sol:HoneycombAgentRegistry",
    constructorArgsRaw: [],
    buildInfo: "core",
  },
  {
    name: "HoneycombBountyEscrow",
    address: deployment.contracts.HoneycombBountyEscrow,
    contractPath: "contracts/HoneycombBountyEscrow.sol:HoneycombBountyEscrow",
    constructorArgsRaw: [deployment.contracts.HoneycombAgentRegistry],
    buildInfo: "core",
  },
  {
    name: "HoneycombPostBond",
    address: deployment.contracts.HoneycombPostBond,
    contractPath: "contracts/HoneycombPostBond.sol:HoneycombPostBond",
    constructorArgsRaw: [deployment.contracts.HoneycombAgentRegistry, deployment.deployer],
    buildInfo: "core",
  },
  {
    name: "HoneycombReputation",
    address: deployment.contracts.HoneycombReputation,
    contractPath: "contracts/HoneycombReputation.sol:HoneycombReputation",
    constructorArgsRaw: [],
    buildInfo: "core",
  },
  {
    name: "HoneycombFeeVault",
    address: deployment.contracts.HoneycombFeeVault,
    contractPath: "contracts/launchpad/HoneycombFeeVault.sol:HoneycombFeeVault",
    constructorArgsRaw: [],
    buildInfo: "launchpad_full",
  },
  {
    name: "HoneycombTokenFactory",
    address: deployment.contracts.HoneycombTokenFactory,
    contractPath: "contracts/launchpad/HoneycombTokenFactory.sol:HoneycombTokenFactory",
    constructorArgsRaw: [deployment.contracts.HoneycombAgentRegistry],
    buildInfo: "launchpad_full",
  },
  {
    name: "HoneycombBondingCurveMarket",
    address: deployment.contracts.HoneycombBondingCurveMarket,
    contractPath: "contracts/launchpad/HoneycombBondingCurveMarket.sol:HoneycombBondingCurveMarket",
    constructorArgsRaw: [
      deployment.contracts.HoneycombTokenFactory,
      deployment.contracts.HoneycombFeeVault,
      deployment.config.graduationThreshold,
      deployment.config.cooldownSeconds.toString(),
      deployment.config.maxBuyPerTx,
      deployment.config.launchDelay.toString(),
      deployment.config.initialVirtualNative,
      deployment.config.initialVirtualToken,
    ],
    buildInfo: "launchpad_full",
  },
  {
    name: "HoneycombMigration",
    address: deployment.contracts.HoneycombMigration,
    contractPath: "contracts/launchpad/HoneycombMigration.sol:HoneycombMigration",
    constructorArgsRaw: [
      deployment.contracts.HoneycombBondingCurveMarket,
      deployment.dexConfig.router,
      deployment.dexConfig.wbnb,
      deployment.dexConfig.lpLockAddress,
      deployment.deployer,
    ],
    buildInfo: "launchpad_full",
  },
];

function encodeConstructorArgs(args) {
  if (!args || args.length === 0) return "";
  return args
    .map((arg) => {
      if (typeof arg === "string" && arg.startsWith("0x")) {
        return arg.slice(2).toLowerCase().padStart(64, "0");
      }
      const bn = BigInt(arg);
      return bn.toString(16).padStart(64, "0");
    })
    .join("");
}

async function checkVerification(address) {
  const url = `${CHECK_URL}&module=contract&action=getabi&address=${address}&apikey=${BSCSCAN_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.status === "1";
}

async function verifyContract(contract) {
  const buildInfo = buildInfoFiles[contract.buildInfo];

  const standardInput = {
    language: buildInfo.input.language,
    sources: buildInfo.input.sources,
    settings: buildInfo.input.settings,
  };

  const constructorArgs = encodeConstructorArgs(contract.constructorArgsRaw);

  const params = new URLSearchParams();
  params.append("module", "contract");
  params.append("action", "verifysourcecode");
  params.append("apikey", BSCSCAN_API_KEY);
  params.append("contractaddress", contract.address);
  params.append("sourceCode", JSON.stringify(standardInput));
  params.append("codeformat", "solidity-standard-json-input");
  params.append("contractname", contract.contractPath);
  params.append("compilerversion", `v${buildInfo.solcLongVersion}`);
  if (buildInfo.input.settings?.optimizer?.enabled) {
    params.append("optimizationUsed", "1");
    params.append("runs", (buildInfo.input.settings.optimizer.runs || 200).toString());
  } else {
    params.append("optimizationUsed", "0");
  }
  const evmVersion = buildInfo.input.settings?.evmVersion || "paris";
  params.append("evmversion", evmVersion);
  params.append("licenseType", "3");
  if (constructorArgs) {
    params.append("constructorArguements", constructorArgs);
  }

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json();
  return data;
}

async function checkVerificationStatus(guid) {
  const url = `${CHECK_URL}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${BSCSCAN_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Starting BscScan contract verification via Etherscan V2 API...");
  console.log("Using ORIGINAL build-info files from deployment commit\n");

  for (const [key, bi] of Object.entries(buildInfoFiles)) {
    console.log(`Build ${key}: solc v${bi.solcLongVersion}, optimizer: ${bi.input.settings?.optimizer?.enabled || false}, runs: ${bi.input.settings?.optimizer?.runs || 'N/A'}, viaIR: ${bi.input.settings?.viaIR || false}`);
  }

  console.log(`\nAPI Key: ${BSCSCAN_API_KEY ? "Set (" + BSCSCAN_API_KEY.slice(0, 4) + "...)" : "MISSING!"}\n`);

  if (!BSCSCAN_API_KEY) {
    console.error("BSCSCAN_API_KEY is not set!");
    process.exit(1);
  }

  const results = [];

  for (const contract of contracts) {
    console.log(`\n--- Verifying ${contract.name} ---`);
    console.log(`Address: ${contract.address}`);
    console.log(`Using build-info: ${contract.buildInfo}`);

    const alreadyVerified = await checkVerification(contract.address);
    if (alreadyVerified) {
      console.log(`Already verified!`);
      results.push({ name: contract.name, status: "already_verified" });
      continue;
    }

    const submitResult = await verifyContract(contract);
    console.log(`Submit result:`, JSON.stringify(submitResult));

    if (submitResult.status === "0") {
      if (submitResult.result && submitResult.result.includes("Already Verified")) {
        console.log(`Already verified!`);
        results.push({ name: contract.name, status: "already_verified" });
        continue;
      }
      console.error(`Failed: ${submitResult.result}`);
      results.push({ name: contract.name, status: "failed", error: submitResult.result });
      await sleep(5000);
      continue;
    }

    const guid = submitResult.result;
    console.log(`GUID: ${guid}`);
    console.log(`Waiting for verification...`);

    let verified = false;
    let finalStatus = "";
    for (let i = 0; i < 15; i++) {
      await sleep(10000);
      const status = await checkVerificationStatus(guid);
      console.log(`  Check ${i + 1}: ${status.result}`);
      finalStatus = status.result;

      if (status.result === "Pass - Verified") {
        verified = true;
        break;
      }
      if (status.result && !status.result.includes("Pending")) {
        break;
      }
    }

    results.push({
      name: contract.name,
      status: verified ? "verified" : "failed",
      detail: finalStatus,
    });

    await sleep(3000);
  }

  console.log("\n\n========== VERIFICATION SUMMARY ==========");
  let allGood = true;
  for (const r of results) {
    const icon = r.status === "verified" || r.status === "already_verified" ? "OK" : "FAIL";
    if (icon === "FAIL") allGood = false;
    console.log(`  [${icon}] ${r.name}: ${r.status}${r.detail ? " - " + r.detail : ""}${r.error ? " - " + r.error : ""}`);
  }
  console.log("==========================================");

  if (allGood) {
    console.log("\nAll contracts verified successfully!");
  } else {
    console.log("\nSome contracts failed verification. Check errors above.");
  }
}

main().catch(console.error);
