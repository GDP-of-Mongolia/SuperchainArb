import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export type ForgeScriptReturnArg = Promise<() => void>;

const READY_TEXT = 'Script run completed'; // Adjust this based on expected output
const STD_OUT_PATH = path.resolve(__dirname, './stdout_forge.txt');
const STD_ERR_PATH = path.resolve(__dirname, './stderr_forge.txt');

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
        const cleanup = await runForgeScript();
    } catch (error) {
        console.error('Error executing forge script:', error);
    }
})();
