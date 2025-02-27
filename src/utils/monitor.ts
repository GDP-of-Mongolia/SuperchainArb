// write a flexible listener function that returns unwatch 
// function should work with multiple chains and uniswap V2 deployments
// we are mostly concerned with the Swap pair event
// consideration: do we want to listen to the pair directly, or do we want to listen to the router
// if we listen to the router, we would have to iterate each transactions logs to dig out the SWAP events
// at a seperate part of our code, we will start a listener instance for each chain / DEX we want to monitor
// we will consolidate the data in one spot to calculate the arbs
// the aim is to be ~somewhat flexible in adding more DEXs / chains

import { type V2PoolReservesUpdate, type V2Instance } from "./arbCalc";

import { createPublicClient, http, parseAbiItem, type PublicClient } from "viem";

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

export function watchSyncEvents(
    publicClient: PublicClient,
    v2Instance: V2Instance,
    pairAddress: `0x${string}`,
    onPriceUpdate: (update: V2PoolReservesUpdate) => void
): () => void {
    if (!publicClient.chain) {
        throw new Error("PublicClient does not have a chain defined.");
    }

    const unwatch = publicClient.watchEvent({
        address: pairAddress as `0x${string}`,
        event: UNISWAP_V2_SYNC_ABI,
        onLogs: (logs) => {
            // for (const log of logs) {
            //     // Extract reserves from the Sync event.
            //     if (logs.args.reserve0) {
            //         const reserve0: bigint = log.args.reserve0;
            //         const reserve1: bigint = log.args.reserve1;
            //     }

            //     if (reserve0 === 0n) {
            //         console.warn("reserve0 is zero, cannot compute price.");
            //         continue;
            //     }

            //     // Compute price: assume token0 is the base token.
            //     const price = Number(reserve1) / Number(reserve0);
            //     console.log(
            //         `Sync event on ${rpcUrl}: reserve0=${reserve0}, reserve1=${reserve1}, price=${price}`
            //     );

            //     // Send the price update for arbitrage processing.
            //     onPriceUpdate({ rpcUrl, price });
            // }
            for (const log of logs) {
                const v2PriceUpdate: V2PoolReservesUpdate = {

                    v2Instance: v2Instance,
                    reserve0: logs.args.reserve0,
                    reserve1: logs.args.reserve1
                }
            }

        },
    });
    return unwatch;
}


