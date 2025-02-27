import { createWalletClient, http, createPublicClient } from 'viem';
import type { WalletClient, PublicClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts';
import { tokenAbi, tokenBytecode } from '';

import { chains, salt, owner_address, name, symbol, decimals } from '../config/deployConfig';
import { PRIVATE_KEY } from '../config/config';
import { writeContract } from 'viem/actions';


/**
 * Deploys the L2NativeSuperchainERC20 contract on a given chain.
 */
async function deployToChain(
    walletClient: WalletClient,
): Promise<{ deployedAddress: string }> {

    // Deploy the L2NativeSuperchainERC20 contract
    const deployedAddress = await walletClient.deployContract({
        abi: tokenAbi,
        bytecode: tokenBytecode,
        args: [owner_address, name, symbol, decimals],
    });

    return { deployedAddress };
}

async function deploySuperChainERC20() {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("PRIVATE_KEY must be set in environment variables");
    }

    const results: { rpcUrl: string; deployedAddress: string; }[] = [];

    // Loop over each chain defined in the config and deploy the token
    for (const rpcUrl of chains) {
        const result = await deployToChain(walletClient);
        results.push({
            rpcUrl,
            deployedAddress: result.deployedAddress,
        });
    }

    // Write the deployment results to a JSON file for later reference
    const output = {
        results,
        tokenOwner: owner_address,
    };
}
