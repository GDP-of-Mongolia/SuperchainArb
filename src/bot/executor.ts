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
	formatEther,
} from 'viem';
import { watchSyncEvents } from '../utils/monitor';
import { BRIDGE_SWAP_CONTRACT, chainIDToRPCUrls, chainIDtoChain } from '../config/config';
import { BRIDGE_SWAP_ABI } from '../constants/abi/BridgeSwapABI';
import { WETH_ADDRESSES } from '../constants/addresses';
import { bridgeBack } from '../../testBridgeBack';

// import pino from 'pino';
import { sleep } from 'bun';
// const logger = pino({ level: 'info' });
import winston from 'winston';

const logger = winston.createLogger({
	level: 'info',
	format: winston.format.combine(
		winston.format.timestamp({ format: 'HH:mm:ss' }),
		winston.format.printf(({ timestamp, level, message }) => {
			return `${timestamp} [${level.toUpperCase()}]: ${message}`;
		}),
		winston.format.colorize({ all: true }),
	),
	transports: [new winston.transports.Console()],
});

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
		logger.info(
			`Received price update from DEX: ${update.v2Instance.dexName} at chainID: ${update.v2Instance.chainId}`,
		);
		logger.info(
			`contract address of token: ${update.weth == 0 ? update.token1 : update.token0}`,
		);
		logger.info(
			`ETH reserves: ${update.weth == 0 ? formatEther(update.reserve0) : formatEther(update.reserve1)}, Token reserves: ${update.weth == 0 ? formatEther(update.reserve1) : formatEther(update.reserve0)}`,
		);
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
			tokenAndV2InstanceToString({
				ca: update.weth == 0 ? update.token1 : update.token0,
				v2Instance: currV2Insance,
			}),
			update,
		);

		if (update.txHash && IGNORE_TX_HASHES.has(update.txHash)) {
			logger.info(
				`the Swap was triggered by the ARB bot, therefore ignoring txHash: ${update.txHash}`,
			);
			return;
		}
		this.checkArb(update.weth == 0 ? update.token1 : update.token0, tokenAndV2Instances);
	};

	checkArb = async (ca: `0x${string}`, v2Instances: V2Instance[]) => {
		logger.info(`Checking for arb opportunities for token: ${ca}`);
		const tokenAndV2Instances: TokenAndV2Instance[] = v2Instances.map((v2Instance) => {
			return { ca: ca, v2Instance: v2Instance };
		});
		const priceUpdates: V2PoolReservesUpdate[] = tokenAndV2Instances.map(
			(tokenAndV2Instance) => {
				const update = this.latestPriceUpdates.get(
					tokenAndV2InstanceToString(tokenAndV2Instance), // using string as key as objects are not easily comparable
				);
				if (!update) {
					return;
				}
				return update as V2PoolReservesUpdate;
			},
		) as V2PoolReservesUpdate[];

		// eliminate undefined elements from priceUpdates

		if (!priceUpdates) {
			logger.warn('priceUpdates is undefined!');
			return;
		}
		const priceUpdatePairs = getPriceUpdatePairs(priceUpdates);

		// evaluating arb oppurtunities both sides of each pair defined in executor

		for (const pair of priceUpdatePairs) {
			const arb = evaluateV2ArbOppurtunity(pair[0], pair[1]);
			if (!arb) {
				continue;
			}
			await this.executeArb(arb);
		}
	};

	executeArb = async (execution: V2ArbExecution) => {
		const ca = (execution.instructions[0] as SwapV2Ins).path[1];
		const amountIn = (execution.instructions[0] as SwapV2Ins).amountIn;
		const amount = (execution.instructions[0] as SwapV2Ins).amountIn;
		const originChainID = (execution.instructions[1] as BridgeSuperchainERC20Ins).fromChainID;
		const destChainID = (execution.instructions[1] as BridgeSuperchainERC20Ins).toChainID;
		const ethAddress = WETH_ADDRESSES.get(originChainID);
		if (!ethAddress) {
			return;
		}
		const originRouterV2 = (execution.instructions[0] as SwapV2Ins).v2Instance.routerAddress;
		const destinationRouterV2 = (execution.instructions[2] as SwapV2Ins).v2Instance
			.routerAddress;

		const publicClient = createPublicClient({
			chain: chainIDtoChain.get(originChainID),
			transport: http(chainIDToRPCUrls.get(originChainID) as string),
		});
		const walletClient = createWalletClient({
			chain: chainIDtoChain.get(originChainID),
			transport: http(chainIDToRPCUrls.get(originChainID) as string),
		});

		logger.info(
			`Executing arb for token: ${ca} from chainID: ${originChainID} to chainID: ${destChainID}`,
		);

		const balance = await publicClient.getBalance({ address: this.arbAccount.address });

		logger.info(`Arb account balance before arbitrage transaction: ${formatEther(balance)}`);

		const { request } = await publicClient.simulateContract({
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
		});
		const txHash = await walletClient.writeContract(request);

		logger.info(`Arb transaction sent, txHash: ${txHash}`);

		// adding txHash to ignore list, so that our event listener can avoid looking for arbitrages on our swaps

		IGNORE_TX_HASHES.add(txHash);

		const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

		await sleep(2000);

		const postBalance = await publicClient.getBalance({ address: this.arbAccount.address });
		logger.info(`Arb account balance after arbitrage transaction: ${formatEther(postBalance)}`);

		const profit = postBalance - balance;

		logger.info(`Arbitrage profit: ${formatEther(profit)}`);

		return receipt;
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
			if (!priceUpdates[i] || !priceUpdates[j]) {
				continue;
			}
			pairs.push([priceUpdates[i], priceUpdates[j]]);
			pairs.push([priceUpdates[j], priceUpdates[i]]);
		}
	}
	return pairs;
};
