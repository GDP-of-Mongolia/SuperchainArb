import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export type ForgeScriptReturnArg = Promise<() => void>;

const READY_TEXT = 'Script run completed'; // Adjust this based on expected output
const STD_OUT_PATH = path.resolve(__dirname, './stdout_forge.txt');
const STD_ERR_PATH = path.resolve(__dirname, './stderr_forge.txt');


// Paths to relevant files
const DEPLOY_CONFIG_PATH = path.resolve('src/config/deploy-config.toml');
const DEPLOYMENT_JSON_PATH = path.resolve('deployment.json');
const CONFIG_TS_PATH = path.resolve('src/config/config.ts');

// Function to update the deploy-config.toml file with a unique salt
function updateDeployConfig() {
    try {
        let config = fs.readFileSync(DEPLOY_CONFIG_PATH, 'utf-8');

        // Generate a random integer to append to the salt
        const randomInt = Math.floor(Math.random() * 100000);
        config = config.replace(/salt = ".*"/, `salt = "ethers hen ${randomInt}"`);

        // Write the modified content back
        fs.writeFileSync(DEPLOY_CONFIG_PATH, config, 'utf-8');
        console.log(`Updated salt in deploy-config.toml: ethers hen ${randomInt}`);
    } catch (error) {
        console.error('Error updating deploy-config.toml:', error);
    }
}

// Function to update config.ts with the new deployed address
function updateConfigTS() {
    try {
        const deploymentData = JSON.parse(fs.readFileSync(DEPLOYMENT_JSON_PATH, 'utf-8'));

        console.log(`the deployment data is ${deploymentData}`);

        if (!deploymentData.deployedAddress) {
            throw new Error("Missing 'deployedAddress' in deployment.json");
        }

        const tokenAddress = deploymentData.deployedAddress.toLowerCase();

        console.log(`The deployed address is ${tokenAddress}`);

        // Read the current config.ts file
        let configContent = fs.readFileSync(CONFIG_TS_PATH, 'utf-8');

        // Replace the existing token address
        configContent = configContent.replace(
            /export const TOKEN_ADDRESS = '0x[a-fA-F0-9]{40}';/,
            `export const TOKEN_ADDRESS = '${tokenAddress}';`
        );

        // Write the updated content back to config.ts
        fs.writeFileSync(CONFIG_TS_PATH, configContent, 'utf-8');
        console.log(`Updated TOKEN_ADDRESS in config.ts: ${tokenAddress}`);
    } catch (error) {
        console.error('Error updating config.ts:', error);
    }
}


// Run both updates





export async function runForgeScript(): ForgeScriptReturnArg {
    const args = [
        'script',
        'src/contracts/SuperchainERC20Deployer.sol',
        '--broadcast',
        '--private-key', '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        '--via-ir'
    ];

    fs.writeFileSync(STD_OUT_PATH, '');
    fs.writeFileSync(STD_ERR_PATH, '');

    const forgeProcess = spawn('forge', args, { shell: true });

    const cleanup = () => {
        if (!forgeProcess.killed) {
            forgeProcess.kill();
        }
    };

    return new Promise((resolve, reject) => {
        forgeProcess.stdout.on('data', (data) => {
            const blob = data.toString();
            fs.appendFileSync(STD_OUT_PATH, blob.replace(/\\n/g, '\n'));

            if (blob.includes(READY_TEXT)) {
                resolve(cleanup);
            }
        });

        forgeProcess.stderr.on('data', (data) => {
            const blob = data.toString();
            fs.appendFileSync(STD_ERR_PATH, blob.replace(/\\n/g, '\n'));
            reject(blob);
        });
    });
}

(async () => {
    try {
        updateDeployConfig();
        const cleanup = await runForgeScript();
        updateConfigTS();
    } catch (error) {
        console.error('Error executing forge script:', error);
        updateConfigTS();
    }
})();
