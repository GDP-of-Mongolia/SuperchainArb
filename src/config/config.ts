import { type Client, type PublicClient, type WalletClient } from 'viem';
import {
    http,
    encodeFunctionData,
    createPublicClient,
    createWalletClient,
    parseAbi,
    defineChain,
    publicActions,
    walletActions,
    type Chain,
} from 'viem';
import {
    contracts,
    publicActionsL2,
    walletActionsL2,
    createInteropSentL2ToL2Messages,
    decodeRelayedL2ToL2Messages,
} from '@eth-optimism/viem';

import { privateKeyToAccount } from 'viem/accounts';

import { base, optimism, mainnet } from 'viem/chains';

import { supersimL2A, supersimL2B } from '@eth-optimism/viem/chains';
// import { number } from 'mathjs';

export const SUPERSIM_SUPERC20_ADDRESS = '0x420beeF000000000000000000000000000000001';

export const SUPERCHAIN_TOKEN_BRIDGE = '0x4200000000000000000000000000000000000028';

export const L2TOL2_MESSENGER = '0x4200000000000000000000000000000000000023';

export const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

export const PUBLIC_KEY = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

export const DEADLINE = 2000000000; // used for deadline parameter in a variety of functions

export const chainIDToRPCUrls: Map<number, `https://${string}` | `http://${string}`> = new Map<
    number,
    `https://${string}` | `http://${string}`
>([
    [10, 'http://127.0.0.1:9545'],
    [8453, 'http://127.0.0.1:9546'],
]);

// export const chainIDToPublicClient: Map<number, PublicClient> = new Map<
// 	number,
// 	PublicClient | Client
// >([
// 	[
// 		10,
// 		createPublicClient({
// 			chain: optimism,
// 			transport: http('http://127.0.0.1:9545'),
// 		}) as PublicClient,
// 	],
// 	[
// 		8453,
// 		createPublicClient({
// 			chain: base,
// 			transport: http('http://127.0.0.1:9546'),
// 		}) as PublicClient,
// 	],
// ]);

export const chainIDToWalletClient: Map<number, WalletClient> = new Map<number, WalletClient>([
    [
        10,
        createWalletClient({
            chain: optimism,
            transport: http('http://127.0.0.1:9545'),
            // account: PUBLIC_KEY as `0x${string}`, // Ensuring correct type
        }),
    ],
    [
        8453,
        createWalletClient({
            chain: base,
            transport: http('http://127.0.0.1:9546'),
            // account: PUBLIC_KEY as `0x${string}`,
        }),
    ],
]);

export const chainIDtoChain = new Map<number, Chain>([
    [10, optimism],
    [8453, base],
]);

export const DEPLOYER_ACCOUNT = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

export const ARBITRAGEOUR_ACCOUNT = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');

export const FAT_FINGER_ACCOUNT = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a');

// EXTEND PUBLIC ACTIONS L2,
export const BRIDGE_SWAP_CONTRACT = '0x181ca975ae6bfceaef23dcfac60e244a3549d097';

export const TOKEN_ADDRESS = '0xfdf1980e286a3a7b78364fc6ce20cddc6d42501c';