import * as fs from "fs";
import * as path from "path";

const CONTRACTS = [
  "HoneycombAgentRegistry",
  "HoneycombBountyEscrow", 
  "HoneycombPostBond",
  "HoneycombReputation",
  "HoneycombPredictDuel",
];

async function main() {
  console.log("Exporting contract ABIs for frontend...\n");

  const artifactsDir = path.join(__dirname, "../artifacts/contracts");
  const outputDir = path.join(__dirname, "../../client/src/contracts");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const abis: Record<string, any> = {};

  for (const contractName of CONTRACTS) {
    const artifactPath = path.join(
      artifactsDir,
      `${contractName}.sol`,
      `${contractName}.json`
    );

    if (!fs.existsSync(artifactPath)) {
      console.log(`⚠️  Artifact not found for ${contractName}, skipping...`);
      continue;
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    abis[contractName] = artifact.abi;

    // Also write individual ABI files
    const abiFile = path.join(outputDir, `${contractName}.json`);
    fs.writeFileSync(abiFile, JSON.stringify(artifact.abi, null, 2));
    console.log(`✅ Exported ${contractName} ABI`);
  }

  // Write combined ABIs file
  const combinedFile = path.join(outputDir, "abis.ts");
  const content = `// Auto-generated contract ABIs
// Do not edit manually - run 'npx hardhat run contracts/scripts/export-abis.ts'

${CONTRACTS.map(
  (name) =>
    `export const ${name}ABI = ${JSON.stringify(abis[name] || [], null, 2)} as const;`
).join("\n\n")}

export const ContractABIs = {
  ${CONTRACTS.map((name) => `${name}: ${name}ABI`).join(",\n  ")},
} as const;
`;

  fs.writeFileSync(combinedFile, content);
  console.log(`\n✅ Combined ABIs written to: ${combinedFile}`);
}

main().catch(console.error);
