// ADD LIQUIDITY FUNCTION

import {
    type WalletClient,
    getCreate2Address,
    keccak256,
    encodePacked,
    type PrivateKeyAccount,
} from 'viem';
import { ROUTER_V2_ABI } from '../constants/abi/ABIs';
import { DEADLINE } from '../config/config';
import {
    UNISWAP_V2_ROUTER_ADDRESSES,
    WETH_ADDRESSES,
    UNISWAP_V2_FACTORY_ADDRESSES,
    INIT_CODE_HASHES,
} from '../constants/addresses';

export const getAmountOut = (
    amountIn: bigint,
    reserveIn: bigint,
    reserveOut: bigint,
    fees: number,
): bigint => {
    const feesBips = fees * 100;
    const amountInWithFee = amountIn * BigInt(1000 - feesBips);
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * BigInt(1000) + amountInWithFee;
    const amountOut = numerator / denominator;
    return amountOut;
};

export const pairFor = (
    tokenA: `0x${string}`,
    tokenB: `0x${string}`,
    chainId: number,
): `0x${string}` => {
    const tokenOrder: readonly [`0x${string}`, `0x${string}`] =
        tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
    const factoryAddress = UNISWAP_V2_FACTORY_ADDRESSES.get(chainId)!;
    const initCodeHash = INIT_CODE_HASHES.get(chainId)!;

    if (!factoryAddress) {
        console.warn('No factory address found for chainId:', chainId);
    }
    if (!initCodeHash) {
        console.warn('No init code hash found for chainId:', chainId);
    }

    const pairAddress = getCreate2Address({
        from: factoryAddress,
        bytecodeHash: initCodeHash,
        salt: keccak256(encodePacked(['address', 'address'], tokenOrder)),
    });

    return pairAddress;
};

// flexibility for different chains
// knowing which chains have which router v2 addresses (V2Instance interface)
// knowing which chains have which factory addresses (V2Instance interface)
// knowing which chains have which weth addresses (V2Instance interface?)
// knowing which chains have which fee amounts (V2Instance interface)
// chains have chainid obviously

/**
 * needed for fat fingering functionality
 */
export const buy = async (
    walletClient: WalletClient,
    account: PrivateKeyAccount,
    buyAmount: bigint,
    token: `0x${string}`,
    chainId: number,
) => {
    const buyPath = [WETH_ADDRESSES.get(chainId)!, token];

    if (!walletClient.chain) {
        return;
    }

    const buyHash = await walletClient.writeContract({
        address: UNISWAP_V2_ROUTER_ADDRESSES.get(chainId)!,
        abi: ROUTER_V2_ABI,
        functionName: 'swapExactETHForTokens',
        args: [1n, buyPath, account.address, BigInt(DEADLINE)],
        value: buyAmount,
        gas: 500000n,
        account: account,
        chain: walletClient.chain,
    });

    return buyHash;
};

export const sell = async (
    walletClient: WalletClient,
    account: PrivateKeyAccount,
    sellAmount: bigint,
    token: `0x${string}`,
    chainId: number,
) => {
    const sellPath = [token, WETH_ADDRESSES.get(chainId)!];

    const request = await walletClient.writeContract({
        address: UNISWAP_V2_ROUTER_ADDRESSES.get(chainId)!,
        abi: ROUTER_V2_ABI,
        functionName: 'swapExactTokensForETH',
        args: [sellAmount, 1n, sellPath, account.address, BigInt(DEADLINE)],
        gas: 500000n,
        account: account,
        chain: walletClient.chain,
    });
};
