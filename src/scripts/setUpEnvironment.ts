
import fs from 'fs';
import path from 'path';


// deploy the BridgeSwap contract 


const { spawn } = Bun;

const deployToken = async () => {
    const process = spawn([
        "-f",
        ".env",
        "cross-env-shell",
        "forge script src/contracts/SuperchainERC20Deployer.sol --broadcast --private-key $DEPLOYER_PRIVATE_KEY"
    ]);


    const exitCode = await process.exited;
    console.log(`Deployment finished with exit code ${exitCode}`);
};

deployToken();


// Read the deployment.json file
const deploymentPath = path.join(__dirname, '../../deployment.json');
const deploymentJson = fs.readFileSync(deploymentPath, 'utf8');
const deployment = JSON.parse(deploymentJson);

const deployedTokenAddress = deployment.deployedAddress; // e.g. "0x5BCf71Ca0CE963373d917031aAFDd6D98B80B159"
const deployedBridgeAddress = deployment.bridgeAddress;