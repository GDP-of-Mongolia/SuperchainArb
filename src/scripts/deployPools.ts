import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { DEADLINE, PRIVATE_KEY, PUBLIC_KEY, ROUTER_V2_ADDRESS } from '../config/config';
import { ROUTER_V2_ABI, TOKEN_ABI } from '../constants/abi/ABIs';


/**
     * ON CHAIN ACTIONS
     */
/**
* @requires tokenSupply tokenSupply needs to be initialized before calling this function
* @requires deployerAccount deployerAccount needs to be initialized before calling this function
* @requires deployerAmount deployerAmount needs to be initialized before calling this function
* @returns 
*/
async function addLiquidity(amountEth: bigint, token: string, rpcUrl: string, supply: bigint) {
    // Create a wallet client using viem
    const walletClient = createWalletClient({
        account: privateKeyToAccount(PRIVATE_KEY as `0x${string}`),
        transport: http(rpcUrl),
    });

    const viemClient = createPublicClient({
        transport: http(rpcUrl),
    });

    try {
        // Approve add liquidity
        const approveAddLiquidityHash = await walletClient.writeContract({
            abi: TOKEN_ABI,
            address: token as `0x${string}`,
            functionName: 'approve',
            args: [ROUTER_V2_ADDRESS, 115792089237316195423570985008687907853269984665640564039457584007913129639935n],
            nonce: 1,
            gas: 100000n
        });

        const approveAddLiquidityReceipt = await viemClient.waitForTransactionReceipt({ hash: approveAddLiquidityHash });

        const { request, result } = await viemClient.simulateContract({
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