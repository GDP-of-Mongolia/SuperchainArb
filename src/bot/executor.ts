// What do you need for the whole executor
// 1. Set up supersim
// 2. Set up environment
// 3. Deploy SuperchainERC20 on all applicable pools(i.e. on 2 chains for our use case basically)
// 4. Add Liquidity to the pools on all chains( again, 2 chains for our use case)
// 5. Startup Listener, which monitors price discrepancy
// 6. Ape into one of the pools with ETH (code pending)
// 7. Listener code detects sync event, calls check. Check passes
// 8. execute code called, which basically calls the smart contract to do both the swap and bridge, on both chains. (code pending)
// 9. Once, the arb is completed, we would like to generate a log or recording of the arb buy price, the chains, sell price.


// what other data would we want logged or recorded?
// 1. What the expected arb was, our projected buy price and sell price.
// 2. Actual arb details, buy execution price, sell execution price.

import { type V2PoolReservesUpdate, type V2Instance, type V2ArbExecution, evaluateV2ArbOppurtunity } from "../utils/arbCalc"
import { type WatchEventReturnType, type PublicClient } from "viem";
import { watchSyncEvents } from "../utils/monitor";
import { chainIDToPublicClient } from "../config/config";

export interface TokenAndV2Instance {
    ca: `0x${string}`;
    v2Instance: V2Instance;
}

class Executor {

    tokensAndInstances: Map<`0x${string}`, V2Instance[]>;
    latestPriceUpdates: Map<TokenAndV2Instance, V2PoolReservesUpdate> = new Map();
    unwatches: WatchEventReturnType[] = [];

    /**
     * poc would have only one token passed, and two v2Instances
     */
    constructor(tokensAndInstances: Map<`0x${string}`, V2Instance[]>) {
        this.tokensAndInstances = tokensAndInstances;
    }

    setup = () => {
        // set up listeners
        this.tokensAndInstances.forEach((v2Instances, ca) => {
            v2Instances.forEach((v2Instance) => {
                const tokenAndV2Instance = { ca: ca, v2Instance: v2Instance };
                const client = chainIDToPublicClient.get(v2Instance.chainId) as PublicClient;
                if (!client) {
                    return;

                }
                const unwatch = watchSyncEvents(client, tokenAndV2Instance, this.onPriceUpdate);
                this.unwatches.push(unwatch);
            });
        })
    };

    onPriceUpdate = async (update: V2PoolReservesUpdate) => {
        const tokenAndV2Instances = this.tokensAndInstances.get(update.weth == 0 ? update.token1 : update.token0);
        if (!tokenAndV2Instances) {
            return;
        }
        const currV2Insance = tokenAndV2Instances.find(v2Instance => v2Instance = update.v2Instance);
        if (!currV2Insance) {
            return;
        }
        this.latestPriceUpdates.set({ ca: update.weth == 0 ? update.token1 : update.token0, v2Instance: currV2Insance }, update);
        this.checkArb(update.weth == 0 ? update.token1 : update.token0, tokenAndV2Instances);

    };

    checkArb = (ca: `0x${string}`, v2Instances: V2Instance[]) => {
        const tokenAndV2Instances: TokenAndV2Instance[] = v2Instances.map(v2Instance => {
            return { ca: ca, v2Instance: v2Instance };
        });
        const priceUpdates: V2PoolReservesUpdate[] = tokenAndV2Instances.map(tokenAndV2Instance => {
            const update = this.latestPriceUpdates.get(tokenAndV2Instance);
            if (!update) {
                return;
            }
            return update as V2PoolReservesUpdate;
        }) as V2PoolReservesUpdate[];

        if (!priceUpdates) {
            return;
        }
        const priceUpdatePairs = getPriceUpdatePairs(priceUpdates);

        for (const pair of priceUpdatePairs) {
            const arb = evaluateV2ArbOppurtunity(pair[0], pair[1]);
            if (!arb) {
                continue;
            }
            this.executeArb(arb);
        }

    }
    executeArb = async (execution: V2ArbExecution) => {

    }

    closeListeners = () => {
        this.unwatches.forEach(unwatch => {
            unwatch();
        });
    }
}

const getPriceUpdatePairs = (priceUpdates: V2PoolReservesUpdate[]) => {
    const pairs = [];
    for (let i = 0; i < priceUpdates.length; i++) {
        for (let j = i + 1; j < priceUpdates.length; j++) {
            pairs.push([priceUpdates[i], priceUpdates[j]]);
        }
    }
    return pairs;
}