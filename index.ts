/**
 * 1. Start the supersim, fork chains [A, B, ..., N]
 * 2. deploy superchainERC20 token on chain A
 * 3. bridge ERC20 token from chain A to chains [B, ..., N]
 * 4. Determine amount of ETH liquidity to add on chains [A, B, ..., N]
 * 5. Set the ETH balance of account on chains [A, B, ..., N] to the determined amount for each chain.$
 * 6. Add liquidity to the superchainERC20 token on chains [A, B, ..., N]
 * 7. Deploy executor, which bundles the monitoring process, and the orders (transactions) to be placed, and a management/logging tool
 * 8. Simulate a "fat finger" buy on any one of the chains [A, B, ..., N]
 * 9. See if it executes, and log the result
 */

import {
    DEPLOYER_ACCOUNT,
    FAT_FINGER_ACCOUNT,
    chainIDToRPCUrls,
    chainIDToWalletClient,
    ARBITRAGEOUR_ACCOUNT,
    TOKEN_ADDRESS,
} from './src/config/config';
import {
    type PublicClient,
    createPublicClient,
    http,
    createWalletClient,
    parseAbiItem,
    parseAbi,
} from 'viem';
import { addLiquidity } from './src/utils/deployPools';
import { type V2Instance } from './src/utils/arbCalc';

import {
    contracts,
    publicActionsL2,
    walletActionsL2,
    createInteropSentL2ToL2Messages,
    decodeRelayedL2ToL2Messages,
    superchainERC20Abi,
} from '@eth-optimism/viem';

import { base, optimism } from 'viem/chains';
import { Executor } from './src/bot/executor';
import { buy } from './src/utils/uniswapv2';
import { UNISWAP_V2_ROUTER_ADDRESSES } from './src/constants/addresses';

// const optimismPublicClient = chainIDToPublicClient.get(10)?.extend(publicActionsL2());
// const basePublicClient = chainIDToPublicClient.get(8453)?.extend(publicActionsL2());

// const optimismWalletClient = chainIDToWalletClient.get(10)?.extend(walletActionsL2());

const AMOUNT_LIQUIDITY_ETH = 100000000000000000n;
const AMOUNT_LIQUIDITY_TOKEN = 50000000000000000000000n;
const AMOUNT_FAT_FINGER = 1000000000000000000n;

const basePublicClient = createPublicClient({
    chain: base,
    transport: http(chainIDToRPCUrls.get(8453) as string),
}).extend(publicActionsL2());

const optimismPublicClient = createPublicClient({
    chain: optimism,
    transport: http(chainIDToRPCUrls.get(10) as string),
}).extend(publicActionsL2());

const optimismWalletClient = createWalletClient({
    chain: optimism,
    transport: http(chainIDToRPCUrls.get(10) as string),
}).extend(walletActionsL2());

const baseWalletClient = createWalletClient({
    chain: base,
    transport: http(chainIDToRPCUrls.get(8453) as string),
}).extend(walletActionsL2());

const SuperchainArbitrage = async () => {
    // start the supersim
    // deploy superchainerc20 token
    const tokenAddress = TOKEN_ADDRESS;
    // mint tokens

    const mintTokensHashBase = await baseWalletClient.writeContract({
        address: tokenAddress,
        abi: parseAbi(['function mintTo(address to_, uint256 amount_)']),
        functionName: 'mintTo',
        account: DEPLOYER_ACCOUNT,
        args: [DEPLOYER_ACCOUNT.address, AMOUNT_LIQUIDITY_TOKEN],
    });

    const mintTokensHashOptimism = await optimismWalletClient.writeContract({
        address: tokenAddress,
        abi: parseAbi(['function mintTo(address to_, uint256 amount_)']),
        functionName: 'mintTo',
        account: DEPLOYER_ACCOUNT,
        args: [DEPLOYER_ACCOUNT.address, AMOUNT_LIQUIDITY_TOKEN],
    });

    // add liquidity on both chains
    const addLiquidityOptimismHash = await addLiquidity(
        AMOUNT_LIQUIDITY_ETH,
        tokenAddress,
        AMOUNT_LIQUIDITY_TOKEN,
        10,
        DEPLOYER_ACCOUNT,
    );
    const addLiquidityBaseHash = await addLiquidity(
        AMOUNT_LIQUIDITY_ETH,
        tokenAddress,
        AMOUNT_LIQUIDITY_TOKEN,
        8453,
        DEPLOYER_ACCOUNT,
    );
    // deploy executor

    const tokensAndInstances = new Map<`0x${string}`, V2Instance[]>([
        [
            tokenAddress,
            [
                {
                    chainId: 10,
                    dexName: 'UniswapV2',
                    feesBPS: 0.03,
                    routerAddress: UNISWAP_V2_ROUTER_ADDRESSES.get(10) as `0x${string}`,
                },
                {
                    chainId: 8453,
                    dexName: 'UniswapV2',
                    feesBPS: 0.03,
                    routerAddress: UNISWAP_V2_ROUTER_ADDRESSES.get(8453) as `0x${string}`,
                },
            ],
        ],
    ]);

    const executor = new Executor(tokensAndInstances, ARBITRAGEOUR_ACCOUNT);
    executor.setup();


    // simulate a fat finger on optimism

    const fatFingerHash = await buy(
        optimismWalletClient,
        FAT_FINGER_ACCOUNT,
        AMOUNT_FAT_FINGER,
        tokenAddress,
        10,
    );

    // see if it executes and log the result
};

SuperchainArbitrage();
