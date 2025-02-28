// write a flexible listener function that returns unwatch 
// function should work with multiple chains and uniswap V2 deployments
// we are mostly concerned with the Swap pair event
// consideration: do we want to listen to the pair directly, or do we want to listen to the router
// if we listen to the router, we would have to iterate each transactions logs to dig out the SWAP events
// at a seperate part of our code, we will start a listener instance for each chain / DEX we want to monitor
// we will consolidate the data in one spot to calculate the arbs
// the aim is to be ~somewhat flexible in adding more DEXs / chains

import { type V2PoolReservesUpdate, type V2Instance } from "./arbCalc";

import { createPublicClient, http, parseAbiItem, type PublicClient, type WatchEventReturnType, type Client } from "viem";

import { WETH_ADDRESSES } from "../constants/addresses";

import { pairFor } from "./uniswapv2"

import { type TokenAndV2Instance } from "../bot/executor";

// // --- ABI for the Sync event ---
const UNISWAP_V2_SYNC_ABI = parseAbiItem(
    "event Sync(uint112 reserve0, uint112 reserve1)"
);

// // --- Types ---
// export type SyncEvent = {
//     reserve0: bigint;
//     reserve1: bigint;
// };

// @TODO: DATA TYPE FOR WETH ADDRESSES ON ALL CHAINS




// // --- Listener Function ---
// /**
//  * Creates a flexible listener for Sync events on a Uniswap V2 pair.

export const watchSyncEvents = (
    publicClient: PublicClient,
    tokenAndV2Instance: TokenAndV2Instance,
    onPriceUpdate: (update: V2PoolReservesUpdate) => void
): WatchEventReturnType => {
    if (!publicClient.chain) {
        throw new Error("PublicClient does not have a chain defined.");
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
                }
                onPriceUpdate(v2PriceUpdate);
            }

        },
    });
    return unwatch;
}


