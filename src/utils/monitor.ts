// write a flexible listener function that returns unwatch 
// function should work with multiple chains and uniswap V2 deployments
// we are mostly concerned with the Swap pair event
// consideration: do we want to listen to the pair directly, or do we want to listen to the router
// if we listen to the router, we would have to iterate each transactions logs to dig out the SWAP events
// at a seperate part of our code, we will start a listener instance for each chain / DEX we want to monitor
// we will consolidate the data in one spot to calculate the arbs
// the aim is to be ~somewhat flexible in adding more DEXs / chains

import { createPublicClient, http, parseAbiItem, type PublicClient } from "viem";

// --- ABI for the Sync event ---
const UNISWAP_V2_SYNC_ABI = parseAbiItem(
    "event Sync(uint112 reserve0, uint112 reserve1)"
);

// --- Types ---
export type SyncEvent = {
    reserve0: bigint;
    reserve1: bigint;
};

export type PriceUpdate = {
    rpcUrl: string;
    price: number;
};

// Global storage for the latest price per chain
export const priceData: { [rpcUrl: string]: number } = {};

// --- Listener Function ---
/**
 * Creates a flexible listener for Sync events on a Uniswap V2 pair.
 *
 * @param publicClient - A viem PublicClient for the target chain.
 * @param pairAddress - The Uniswap V2 pair contract address.
 * @param rpcUrl - The chain's RPC URL (or name) for identification.
 * @param onPriceUpdate - A callback invoked each time a new price is computed.
 * @returns An unwatch function to stop the listener.
 */
export function watchSyncEvents(
    publicClient: PublicClient,
    pairAddress: string,
    rpcUrl: string,
    onPriceUpdate: (update: PriceUpdate) => void
): () => void {
    const unwatch = publicClient.watchEvent({
        address: pairAddress as `0x${string}`,
        event: UNISWAP_V2_SYNC_ABI,
        onLogs: (logs) => {
            for (const log of logs) {
                // Extract reserves from the Sync event.
                if (logs.args.reserve0) {
                    const reserve0: bigint = log.args.reserve0;
                    const reserve1: bigint = log.args.reserve1;
                }

                if (reserve0 === 0n) {
                    console.warn("reserve0 is zero, cannot compute price.");
                    continue;
                }

                // Compute price: assume token0 is the base token.
                const price = Number(reserve1) / Number(reserve0);
                console.log(
                    `Sync event on ${rpcUrl}: reserve0=${reserve0}, reserve1=${reserve1}, price=${price}`
                );

                // Send the price update for arbitrage processing.
                onPriceUpdate({ rpcUrl, price });
            }
        },
    });
    return unwatch;
}



// --- Arbitrage Executor Stub ---
/**
 * Executes the arbitrage trade by calculating the optimum trade size
 * and calling the BridgeSwap smart contract's function.
 *
 * @param cheapRpc - The RPC URL (or chain identifier) of the cheaper chain.
 * @param expensiveRpc - The RPC URL (or chain identifier) of the expensive chain.
 * @param cheapPrice - The price on the cheaper chain.
 * @param expensivePrice - The price on the expensive chain.
 */
function executeArbitrage(
    cheapRpc: string,
    expensiveRpc: string,
    cheapPrice: number,
    expensivePrice: number
) {
    console.log(
        `Executing arbitrage: Buy on ${cheapRpc} at price ${cheapPrice} and sell on ${expensiveRpc} at price ${expensivePrice}.`
    );
    // TODO: Determine optimum arb size and call your BridgeSwap contract via viem.
    // e.g., callBridgeAndSwap( ... );
}