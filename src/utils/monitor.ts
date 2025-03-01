import { type V2PoolReservesUpdate, type V2Instance } from './arbCalc';

import {
	createPublicClient,
	http,
	parseAbiItem,
	type PublicClient,
	type WatchEventReturnType,
	type Client,
} from 'viem';

import { WETH_ADDRESSES } from '../constants/addresses';

import { pairFor } from './uniswapv2';

import { type TokenAndV2Instance } from '../bot/executor';
import { ARBITRAGEOUR_ACCOUNT, chainIDToRPCUrls, chainIDtoChain } from '../config/config';
import { IGNORE_TX_HASHES } from '../bot/executor';

// // --- ABI for the Sync event ---
const UNISWAP_V2_SYNC_ABI = parseAbiItem('event Sync(uint112 reserve0, uint112 reserve1)');

export const watchSyncEvents = (
	chainId: number,
	tokenAndV2Instance: TokenAndV2Instance,
	onPriceUpdate: (update: V2PoolReservesUpdate) => void,
): WatchEventReturnType => {
	const publicClient = createPublicClient({
		transport: http(chainIDToRPCUrls.get(chainId) as string),
		chain: chainIDtoChain.get(chainId),
	});

	if (!publicClient.chain) {
		throw new Error('PublicClient does not have a chain defined.');
	}

	const tokenAddress = tokenAndV2Instance.ca;
	const v2Instance = tokenAndV2Instance.v2Instance;

	const wethAddress: `0x${string}` = WETH_ADDRESSES.get(v2Instance.chainId) as `0x${string}`;
	const token0 = tokenAddress < wethAddress ? tokenAddress : wethAddress;
	const token1 = tokenAddress < wethAddress ? wethAddress : tokenAddress;
	const pairAddress = pairFor(token0, token1, v2Instance.chainId); // FIX
	const unwatch = publicClient.watchEvent({
		address: pairAddress as `0x${string}`,
		event: UNISWAP_V2_SYNC_ABI,
		onLogs: (logs) => {
			for (const log of logs) {
				if (!log.args.reserve0 || !log.args.reserve1) {
					// console.warn("Sync event is missing reserve0 or reserve1.");
					continue;
				}

				const v2PriceUpdate: V2PoolReservesUpdate = {
					v2Instance: v2Instance,
					reserve0: log.args.reserve0,
					reserve1: log.args.reserve1,
					token0: token0,
					token1: token1,
					weth: wethAddress == token0 ? 0 : 1,
					txHash: log.transactionHash,
				};
				onPriceUpdate(v2PriceUpdate);
			}
		},
	});
	return unwatch;
};
