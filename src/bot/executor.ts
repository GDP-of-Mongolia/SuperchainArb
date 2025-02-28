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
// import { chainIDToPublicClient } from "../config/config";

export interface TokenAndV2Instance {
	ca: `0x${string}`;
	v2Instance: V2Instance;
}

export class Executor {
	tokensAndInstances: Map<`0x${string}`, V2Instance[]>;
	latestPriceUpdates: Map<TokenAndV2Instance, V2PoolReservesUpdate> = new Map();
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
				// const client = chainIDToPublicClient.get(v2Instance.chainId) as PublicClient;
				// if (!client) {
				// 	return;
				// }
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
			{ ca: update.weth == 0 ? update.token1 : update.token0, v2Instance: currV2Insance },
			update,
		);
		this.checkArb(update.weth == 0 ? update.token1 : update.token0, tokenAndV2Instances);
	};

	checkArb = (ca: `0x${string}`, v2Instances: V2Instance[]) => {
		const tokenAndV2Instances: TokenAndV2Instance[] = v2Instances.map((v2Instance) => {
			return { ca: ca, v2Instance: v2Instance };
		});
		const priceUpdates: V2PoolReservesUpdate[] = tokenAndV2Instances.map(
			(tokenAndV2Instance) => {
				const update = this.latestPriceUpdates.get(tokenAndV2Instance);
				if (!update) {
					return;
				}
				return update as V2PoolReservesUpdate;
			},
		) as V2PoolReservesUpdate[];

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
	};

	// //function swapAndBridge(
	// 	address owner,
	// 	address token,
	// 	address recipient,
	// 	uint256 amount,
	// 	uint256 originChainId,
	// 	uint256 destinationChainId,
	// 	address originRouterV2,
	// 	address destRouterV2,
	// 	address destContract
	// )
	executeArb = async (execution: V2ArbExecution) => {
		console.log('Executing arb.');
		const partialABI = parseAbi([
			'function swapAndBridge(address owner, address token, address recipient, uint256 amount, uint256 originChainId, uint256 destinationChainId, address originRouterV2, address destRouterV2, address destContract)',
		]);

		const ca = (execution.instructions[0] as SwapV2Ins).path[1];
		console.log('contract address', ca);
		const amount = (execution.instructions[0] as SwapV2Ins).amountIn;
		console.log('amount', amount);
		const originChainID = (execution.instructions[1] as BridgeSuperchainERC20Ins).fromChainID;
		const destChainID = (execution.instructions[1] as BridgeSuperchainERC20Ins).toChainID;
		console.log('originChainID', originChainID, 'destChainID', destChainID);
		const originRouterV2 = (execution.instructions[0] as SwapV2Ins).v2Instance.routerAddress;
		const destinationRouterV2 = (execution.instructions[2] as SwapV2Ins).v2Instance
			.routerAddress;

		const walletClient = createWalletClient({
			chain: chainIDtoChain.get(originChainID),
			transport: http(chainIDToRPCUrls.get(originChainID) as string),
		});

		const txHash = await walletClient.writeContract({
			address: BRIDGE_SWAP_CONTRACT,
			abi: partialABI,
			functionName: 'swapAndBridge',
			args: [
				this.arbAccount.address,
				ca,
				this.arbAccount.address,
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
		});

		console.log('Arb executed with txHash: ', txHash);
		const publicClient = createPublicClient({
			chain: chainIDtoChain.get(originChainID),
			transport: http(chainIDToRPCUrls.get(originChainID) as string),
		});

		const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
	};

	closeListeners = () => {
		this.unwatches.forEach((unwatch) => {
			unwatch();
		});
	};
}

const getPriceUpdatePairs = (priceUpdates: V2PoolReservesUpdate[]) => {
	const pairs = [];
	for (let i = 0; i < priceUpdates.length; i++) {
		for (let j = i + 1; j < priceUpdates.length; j++) {
			pairs.push([priceUpdates[i], priceUpdates[j]]);
			pairs.push([priceUpdates[j], priceUpdates[i]]);
		}
	}
	return pairs;
};
