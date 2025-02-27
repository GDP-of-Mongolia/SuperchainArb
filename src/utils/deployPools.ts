import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { DEADLINE, PRIVATE_KEY, PUBLIC_KEY, ROUTER_V2_ADDRESS } from '../config/config';
import type { WalletClient, PublicClient } from 'viem'
import { ROUTER_V2_ABI } from '../constants/abi/ABIs';
import { tokenAbi, tokenBytecode } from '';


async function addLiquidity(amountEth: bigint, token: string, rpcUrl: string, supply: bigint, walletClient: WalletClient, publicClient: PublicClient) {

    try {
        // Approve add liquidity
        const approveAddLiquidityHash = await walletClient.writeContract({
            abi: tokenAbi,
            address: token as `0x${string}`,
            functionName: 'approve',
            args: [ROUTER_V2_ADDRESS, 115792089237316195423570985008687907853269984665640564039457584007913129639935n],
            nonce: 1,
            gas: 100000n
        });

        const approveAddLiquidityReceipt = await publicClient.waitForTransactionReceipt({ hash: approveAddLiquidityHash });

        const { request, result } = await publicClient.simulateContract({
            account: PUBLIC_KEY,
            address: ROUTER_V2_ADDRESS,
            abi: ROUTER_V2_ABI,
            functionName: "addLiquidityETH",
            args: [token as `0x${string}`, supply, supply, amountEth, PUBLIC_KEY, BigInt(DEADLINE)],
            value: amountEth,
            nonce: 2,
            gas: 3000000n
        });

        const liquidityBalance = result;

        const addLiquidityHash = await walletClient.writeContract(request);

    } catch (error: any) {
        console.error("Error adding liquidity:", error);
        return null;
    }
};