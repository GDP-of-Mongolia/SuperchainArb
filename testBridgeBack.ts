import { createPublicClient, createWalletClient, http, erc20Abi } from "viem"
import { ARBITRAGEOUR_ACCOUNT, TOKEN_ADDRESS, chainIDToRPCUrls, chainIDtoChain } from "./src/config/config"
import { BRIDGE_SWAP_ABI } from "./src/constants/abi/BridgeSwapABI"
import { BRIDGE_SWAP_CONTRACT } from "./src/config/config"
import { WETH_ADDRESSES, UNISWAP_V2_ROUTER_ADDRESSES } from "./src/constants/addresses"

export const bridgeBack = async () => {

    const tokenAddress = TOKEN_ADDRESS
    const publicClient = createPublicClient({
        transport: http(chainIDToRPCUrls.get(10)),
        chain: chainIDtoChain.get(10),
    })

    const num = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [BRIDGE_SWAP_CONTRACT],
    });


    const walletClient = createWalletClient({
        transport: http(chainIDToRPCUrls.get(10)),
        chain: chainIDtoChain.get(10),
    })

    const { request } = await publicClient.simulateContract({
        address: BRIDGE_SWAP_CONTRACT,
        abi: BRIDGE_SWAP_ABI,
        functionName: 'SwapAndBridgeBack',
        args: [
            WETH_ADDRESSES.get(10) as `0x${string}`,
            tokenAddress,
            ARBITRAGEOUR_ACCOUNT.address,
            num,
            BigInt(8453),
            UNISWAP_V2_ROUTER_ADDRESSES.get(10) as `0x${string}`,

        ],
        account: ARBITRAGEOUR_ACCOUNT,
    })

    const hash = await walletClient.writeContract(request);

    console.log("hash", hash);

}


// (async () => {
//     try {
//         const cleanup = await bridgeBack();
//         //cleanup(); // Cleanup process after deployment
//     } catch (error) {
//         console.error('Error in execution:', error);
//     }
// })();