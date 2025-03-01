import {
    type V2PoolReservesUpdate,
    type V2Instance,
    type V2ArbExecution,
    evaluateV2ArbOppurtunity,
    type SwapV2Ins,
    type BridgeSuperchainERC20Ins,
} from '../utils/arbCalc';
import {
    type WatchEventReturnType,
    type PublicClient,
    parseAbi,
    type PrivateKeyAccount,
    createWalletClient,
    http,
    createPublicClient,
} from 'viem';
import { watchSyncEvents } from '../utils/monitor';
import { BRIDGE_SWAP_CONTRACT, chainIDToRPCUrls, chainIDtoChain } from '../config/config';
import { BRIDGE_SWAP_ABI } from '../constants/abi/BridgeSwapABI';
import { WETH_ADDRESSES } from '../constants/addresses';
import { bridgeBack } from '../../testBridgeBack';

export const IGNORE_TX_HASHES = new Set<`0x${string}`>();

export interface TokenAndV2Instance {
    ca: `0x${string}`;
    v2Instance: V2Instance;
}

export const tokenAndV2InstanceToString = (tokenAndV2Instance: TokenAndV2Instance) => {
    return `${tokenAndV2Instance.ca}:${tokenAndV2Instance.v2Instance.chainId}:${tokenAndV2Instance.v2Instance.dexName}`;
};

export class Executor {
    tokensAndInstances: Map<`0x${string}`, V2Instance[]>;
    latestPriceUpdates: Map<string, V2PoolReservesUpdate> = new Map();
    unwatches: WatchEventReturnType[] = [];
    arbAccount: PrivateKeyAccount;

    /**
     * poc would have only one token passed, and two v2Instances
     */
    constructor(
        tokensAndInstances: Map<`0x${string}`, V2Instance[]>,
        arbAccount: PrivateKeyAccount,
    ) {
        this.tokensAndInstances = tokensAndInstances;
        this.arbAccount = arbAccount;
    }

    setup = () => {
        // set up listeners
        this.tokensAndInstances.forEach((v2Instances, ca) => {
            v2Instances.forEach((v2Instance) => {
                const tokenAndV2Instance = { ca: ca, v2Instance: v2Instance };
                const unwatch = watchSyncEvents(
                    v2Instance.chainId,
                    tokenAndV2Instance,
                    this.onPriceUpdate,
                );
                this.unwatches.push(unwatch);
            });
        });
    };

    onPriceUpdate = async (update: V2PoolReservesUpdate) => {
        console.log('Price update received.');
        const tokenAndV2Instances = this.tokensAndInstances.get(
            update.weth == 0 ? update.token1 : update.token0,
        );
        if (!tokenAndV2Instances) {
            return;
        }
        const currV2Insance = tokenAndV2Instances.find(
            (v2Instance) => v2Instance == update.v2Instance,
        );

        if (!currV2Insance) {
            return;
        }
        this.latestPriceUpdates.set(
            tokenAndV2InstanceToString({ ca: update.weth == 0 ? update.token1 : update.token0, v2Instance: currV2Insance }),
            update,
        );

        if (update.txHash && IGNORE_TX_HASHES.has(update.txHash)) {
            return;
        }
        this.checkArb(update.weth == 0 ? update.token1 : update.token0, tokenAndV2Instances);
    };

    checkArb = async (ca: `0x${string}`, v2Instances: V2Instance[]) => {
        const tokenAndV2Instances: TokenAndV2Instance[] = v2Instances.map((v2Instance) => {
            return { ca: ca, v2Instance: v2Instance };
        });
        // console.log('tokenAndV2Instances before .map iteration', tokenAndV2Instances);
        const priceUpdates: V2PoolReservesUpdate[] = tokenAndV2Instances.map(
            (tokenAndV2Instance) => {
                const update = this.latestPriceUpdates.get(
                    tokenAndV2InstanceToString(tokenAndV2Instance),
                );
                if (!update) {
                    return;
                }
                return update as V2PoolReservesUpdate;
            },
        ) as V2PoolReservesUpdate[];

        // console.log('state of latestPriceUpdates', is.latestPriceUpdates);

        // eliminate undefined elements from priceUpdates

        if (!priceUpdates) {
            return;
        }
        const priceUpdatePairs = getPriceUpdatePairs(priceUpdates);

        for (const pair of priceUpdatePairs) {
            const arb = evaluateV2ArbOppurtunity(pair[0], pair[1]);
            if (!arb) {
                continue;
            }
            await this.executeArb(arb);
        }
    };

    executeArb = async (execution: V2ArbExecution) => {
        console.log('Executing arb.');
        const partialABI = parseAbi([
            'function swapAndBridge(address ethAddress, address owner, address token, address recipient, uint256 amount, uint256 originChainId, uint256 destinationChainId, address originRouterV2, address destRouterV2, address destContract)',
        ]);

        const ca = (execution.instructions[0] as SwapV2Ins).path[1];
        const amountIn = (execution.instructions[0] as SwapV2Ins).amountIn;
        console.log('contract address', ca);
        const amount = (execution.instructions[0] as SwapV2Ins).amountIn;
        console.log('amount', amount);
        const originChainID = (execution.instructions[1] as BridgeSuperchainERC20Ins).fromChainID;
        const destChainID = (execution.instructions[1] as BridgeSuperchainERC20Ins).toChainID;
        console.log('originChainID', originChainID, 'destChainID', destChainID);
        const ethAddress = WETH_ADDRESSES.get(originChainID);
        if (!ethAddress) {
            return;
        }
        const originRouterV2 = (execution.instructions[0] as SwapV2Ins).v2Instance.routerAddress;
        const destinationRouterV2 = (execution.instructions[2] as SwapV2Ins).v2Instance
            .routerAddress;
        console.log('originRouter', originRouterV2, 'destChainID', destinationRouterV2);

        const publicClient = createPublicClient({
            chain: chainIDtoChain.get(originChainID),
            transport: http(chainIDToRPCUrls.get(originChainID) as string),
        });
        const walletClient = createWalletClient({
            chain: chainIDtoChain.get(originChainID),
            transport: http(chainIDToRPCUrls.get(originChainID) as string),
        });


        const { request, result } = await publicClient.simulateContract({
            address: BRIDGE_SWAP_CONTRACT,
            abi: BRIDGE_SWAP_ABI,
            functionName: 'swapAndBridge',
            args: [
                ethAddress,
                this.arbAccount.address,
                ca,
                amount,
                BigInt(originChainID),
                BigInt(destChainID),
                originRouterV2,
                destinationRouterV2,
                BRIDGE_SWAP_CONTRACT,
            ],
            gas: 500000n,
            account: this.arbAccount,
            chain: walletClient.chain,
            value: amountIn,
        })
        const txHash = await walletClient.writeContract(request);

        IGNORE_TX_HASHES.add(txHash);


        console.log('Arb executed with txHash: ', txHash);



        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        // await bridgeBack();

        // console.log('Arb executed with receipt: ', receipt);
        return receipt;
    };

    closeListeners = () => {
        this.unwatches.forEach((unwatch) => {
            unwatch();
        });
    };
}

const getPriceUpdatePairs = (priceUpdates: V2PoolReservesUpdate[]) => {
    // console.log(priceUpdates);
    const pairs = [];
    for (let i = 0; i < priceUpdates.length; i++) {
        for (let j = i + 1; j < priceUpdates.length; j++) {
            if (!priceUpdates[i] || !priceUpdates[j]) {
                continue;
            }
            pairs.push([priceUpdates[i], priceUpdates[j]]);
            pairs.push([priceUpdates[j], priceUpdates[i]]);
        }
    }
    return pairs;
};
