// ADD LIQUIDITY FUNCTION

import type { WalletClient } from "viem";
import { ROUTER_V2_ABI } from "../constants/abi/ABIs";
import { DEADLINE } from "../config/config";
import { UNISWAP_V2_ROUTER_ADDRESSES, WETH_ADDRESSES } from "../constants/addresses";



export const getAmountOut = (amountIn: bigint, reserveIn: bigint, reserveOut: bigint, fees: number): bigint => {
    const feesBips = fees * 100;
    const amountInWithFee = amountIn * BigInt(1000 - feesBips);
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * BigInt(1000) + amountInWithFee;
    const amountOut = numerator / denominator;
    return amountOut;
}

export const pairFor(tokenA: `0x${string}`, tokenB: `0x${string}`, chainId: number): `0x${string}` => {

}

// flexibility for different chains
// knowing which chains have which router v2 addresses (V2Instance interface)
// knowing which chains have which factory addresses (V2Instance interface)
// knowing which chains have which weth addresses (V2Instance interface?)
// knowing which chains have which fee amounts (V2Instance interface)
// chains have chainid obviously

export async function buy(walletClient: WalletClient, buyAmount: bigint, token: `0x${string}`, chainId: number) {

    const buyPath = [WETH_ADDRESSES.get(chainId), token];

    const request = await walletClient.writeContract({
        address: UNISWAP_V2_ROUTER_ADDRESSES.get(chainId),
        abi: ROUTER_V2_ABI,
        functionName: 'swapExactETHForTokens',
        args: [1n, buyPath, walletClient.account, BigInt(DEADLINE)],
        value: buyAmount,
        gas: 500000n
    });

}

export async function sell(walletClient: WalletClient, sellAmount: bigint, token: `0x${string}`, chainId: number) {

    const sellPath = [WETH_ADDRESSES.get(chainId), token];

    const request = await walletClient.writeContract({
        address: UNISWAP_V2_ROUTER_ADDRESSES.get(chainId),
        abi: ROUTER_V2_ABI,
        functionName: 'swapExactTokensForETH',
        args: [sellAmount, 1n, sellPath, walletClient.account, BigInt(DEADLINE)],
        gas: 500000n
    });
}


