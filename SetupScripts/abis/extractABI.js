import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths
const contractName = "ERC721"; // Change if needed
const artifactPath = path.join(__dirname, `../../artifacts/contracts/${contractName}.sol/${contractName}.json`);
const abiOutputPath = path.join(__dirname, `${contractName}.json`);

try {
    // Read the compiled contract artifact
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    // Extract only the ABI
    const abiData = { abi: artifact.abi };

    // Write the ABI to the abis/ directory
    fs.writeFileSync(abiOutputPath, JSON.stringify(abiData, null, 2));

    console.log(`✅ ABI extracted successfully: ${abiOutputPath}`);
} catch (error) {
    console.error("❌ Error extracting ABI:", error.message);
}