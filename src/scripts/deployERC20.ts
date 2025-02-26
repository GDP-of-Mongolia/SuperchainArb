import { createWalletClient, http, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { tokenAbi, tokenBytecode } from '';

import { chains, salt, owner_address, name, symbol, decimals } from '../config/deployConfig';
import { PRIVATE_KEY } from '../config/config';


/**
 * Deploys the L2NativeSuperchainERC20 contract on a given chain.
 * @param rpcUrl - The RPC URL for the target chain.
 * @param privateKey - The deployer's private key.
 * @returns The deployed contract address and chain ID.
 */
async function deployToChain(
    rpcUrl: string,
): Promise<{ deployedAddress: string; chainId: number }> {
    console.log(`\nDeploying to chain with RPC: ${rpcUrl}`);

    // Create a wallet client using viem
    const walletClient = createWalletClient({
        account: privateKeyToAccount(PRIVATE_KEY as `0x${string}`),
        transport: http(rpcUrl),
    });

    // Create a public client to fetch chain information. 
    const publicClient = createPublicClient({ transport: http(rpcUrl) });
    const chainId = await publicClient.getChainId();
    console.log(`Chain ID: ${chainId}`);

    // Deploy the L2NativeSuperchainERC20 contract
    const deployedAddress = await walletClient.deployContract({
        abi: tokenAbi,
        bytecode: tokenBytecode,
        args: [owner_address, name, symbol, decimals],
    });

    console.log(
        `Deployed L2NativeSuperchainERC20 at address: ${deployedAddress} on chain ID: ${chainId}`
    );
    return { deployedAddress, chainId };
}

async function deploySuperChainERC20() {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("PRIVATE_KEY must be set in environment variables");
    }

    const results: { rpcUrl: string; deployedAddress: string; chainId: number }[] = [];

    // Loop over each chain defined in the config and deploy the token
    for (const rpcUrl of chains) {
        const result = await deployToChain(rpcUrl);
        results.push({
            rpcUrl,
            deployedAddress: result.deployedAddress,
            chainId: result.chainId,
        });
    }

    // Write the deployment results to a JSON file for later reference
    const output = {
        results,
        tokenOwner: owner_address,
    };
    // writeFileSync('deployment.json', JSON.stringify(output, null, 2));
    console.log(`\nDeployment results written to deployment.json`);
}
