const fs = require("fs");
const path = require("path");

const CONTRACTS = [
  { name: "HoneycombAgentRegistry", dir: "" },
  { name: "HoneycombBountyEscrow", dir: "" },
  { name: "HoneycombPostBond", dir: "" },
  { name: "HoneycombReputation", dir: "" },
  { name: "HoneycombToken", dir: "launchpad" },
  { name: "HoneycombTokenFactory", dir: "launchpad" },
  { name: "HoneycombFeeVault", dir: "launchpad" },
  { name: "HoneycombBondingCurveMarket", dir: "launchpad" },
  { name: "HoneycombMigration", dir: "launchpad" },
];

async function main() {
  console.log("Exporting contract ABIs for frontend...\n");

  const artifactsDir = path.join(__dirname, "../artifacts/contracts");
  const outputDir = path.join(__dirname, "../../client/src/contracts");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const abis = {};

  for (const contract of CONTRACTS) {
    const subDir = contract.dir ? `${contract.dir}/` : "";
    const artifactPath = path.join(
      artifactsDir,
      subDir,
      `${contract.name}.sol`,
      `${contract.name}.json`
    );

    if (!fs.existsSync(artifactPath)) {
      console.log(`⚠️  Artifact not found for ${contract.name}, skipping...`);
      continue;
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    abis[contract.name] = artifact.abi;

    const abiFile = path.join(outputDir, `${contract.name}.json`);
    fs.writeFileSync(abiFile, JSON.stringify(artifact.abi, null, 2));
    console.log(`✅ Exported ${contract.name} ABI`);
  }

  const combinedFile = path.join(outputDir, "abis.ts");
  const contractNames = CONTRACTS.map(c => c.name);
  const content = `// Auto-generated contract ABIs
// Do not edit manually - run 'node contracts/scripts/export-abis.cjs'

${contractNames.map(
  (name) =>
    `export const ${name}ABI = ${JSON.stringify(abis[name] || [], null, 2)} as const;`
).join("\n\n")}

export const ContractABIs = {
  ${contractNames.map((name) => `${name}: ${name}ABI`).join(",\n  ")},
} as const;
`;

  fs.writeFileSync(combinedFile, content);
  console.log(`\n✅ Combined ABIs written to: ${combinedFile}`);
}

main().catch(console.error);
