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

export const DEPLOYER_ACCOUNT = privateKeyToAccount('0x');

export const ARBITRAGEOUR_ACCOUNT = privateKeyToAccount('0x');

export const FAT_FINGER_ACCOUNT = privateKeyToAccount('0x');

// EXTEND PUBLIC ACTIONS L2,
export const BRIDGE_SWAP_CONTRACT = '0x4dc19314fc3019571e951e31dc514e0374d47d47';

export const TOKEN_ADDRESS = '0x2b3B81c58962627EA5D4d992495B00F71Ac2381a';