import {
	DEPLOYER_ACCOUNT,
	SIMULATE_BUY_ACCOUNT,
	chainIDToRPCUrls,
	chainIDToWalletClient,
	ARBITRAGEOUR_ACCOUNT,
	TOKEN_ADDRESS,
	BRIDGE_SWAP_CONTRACT,
} from './src/config/config';
import {
	type PublicClient,
	createPublicClient,
	http,
	createWalletClient,
	parseAbiItem,
	parseAbi,
	erc20Abi,
	formatEther,
} from 'viem';
import { addLiquidity } from './src/utils/deployPools';
import { type V2Instance } from './src/utils/arbCalc';

import {
	contracts,
	publicActionsL2,
	walletActionsL2,
	createInteropSentL2ToL2Messages,
	decodeRelayedL2ToL2Messages,
	superchainERC20Abi,
} from '@eth-optimism/viem';

import { base, optimism } from 'viem/chains';
import { Executor, IGNORE_TX_HASHES } from './src/bot/executor';
import { buy } from './src/utils/uniswapv2';
import { UNISWAP_V2_ROUTER_ADDRESSES } from './src/constants/addresses';
import { sleep } from 'bun';
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

// const optimismPublicClient = chainIDToPublicClient.get(10)?.extend(publicActionsL2());
// const basePublicClient = chainIDToPublicClient.get(8453)?.extend(publicActionsL2());

// const optimismWalletClient = chainIDToWalletClient.get(10)?.extend(walletActionsL2());

const AMOUNT_LIQUIDITY_ETH = 1000000000000000000n;
const AMOUNT_LIQUIDITY_TOKEN = 5000000000000000000000000000n;
const SIMULATE_BUY_AMOUNT = 6000000000000000000n;

const basePublicClient = createPublicClient({
	chain: base,
	transport: http(chainIDToRPCUrls.get(8453) as string),
}).extend(publicActionsL2());

const optimismPublicClient = createPublicClient({
	chain: optimism,
	transport: http(chainIDToRPCUrls.get(10) as string),
}).extend(publicActionsL2());

const optimismWalletClient = createWalletClient({
	chain: optimism,
	transport: http(chainIDToRPCUrls.get(10) as string),
}).extend(walletActionsL2());

const baseWalletClient = createWalletClient({
	chain: base,
	transport: http(chainIDToRPCUrls.get(8453) as string),
}).extend(walletActionsL2());

const SuperchainArbitrage = async () => {
	// Retrieving the token address from the config file

	const tokenAddress = TOKEN_ADDRESS;

	// Minting SuperchainERC20 tokens to Base and Optimism to add liquidity

	const mintTokensHashBase = await baseWalletClient.writeContract({
		address: tokenAddress,
		abi: parseAbi(['function mintTo(address to_, uint256 amount_)']),
		functionName: 'mintTo',
		account: DEPLOYER_ACCOUNT,
		args: [DEPLOYER_ACCOUNT.address, AMOUNT_LIQUIDITY_TOKEN],
	});

	logger.info(
		`Minted ${formatEther(AMOUNT_LIQUIDITY_TOKEN)} tokens on Base to deployer. TX: ${mintTokensHashBase}`,
	);

	const mintTokensHashOptimism = await optimismWalletClient.writeContract({
		address: tokenAddress,
		abi: parseAbi(['function mintTo(address to_, uint256 amount_)']),
		functionName: 'mintTo',
		account: DEPLOYER_ACCOUNT,
		args: [DEPLOYER_ACCOUNT.address, AMOUNT_LIQUIDITY_TOKEN],
	});

	logger.info(
		`Minted ${formatEther(AMOUNT_LIQUIDITY_TOKEN)} tokens on Optimism to deployer. TX: ${mintTokensHashOptimism}`,
	);

	// approving SwapAndBridge contract for infinite spending on Base and Optimism

	const approveHashBase = await baseWalletClient.writeContract({
		address: tokenAddress,
		abi: erc20Abi,
		functionName: 'approve',
		account: ARBITRAGEOUR_ACCOUNT,
		args: [
			BRIDGE_SWAP_CONTRACT,
			115792089237316195423570985008687907853269984665640564039457584007913129639935n,
		],
	});

	logger.info(
		`Approved ${BRIDGE_SWAP_CONTRACT} for infinite spending on Base. TX: ${approveHashBase}`,
	);

	const approveHashOptimism = await optimismWalletClient.writeContract({
		address: tokenAddress,
		abi: erc20Abi,
		functionName: 'approve',
		account: ARBITRAGEOUR_ACCOUNT,
		args: [
			BRIDGE_SWAP_CONTRACT,
			115792089237316195423570985008687907853269984665640564039457584007913129639935n,
		],
	});

	logger.info(
		`Approved ${BRIDGE_SWAP_CONTRACT} for infinite spending on Optimism. TX: ${approveHashOptimism}`,
	);

	const tokensAndInstances = new Map<`0x${string}`, V2Instance[]>([
		[
			tokenAddress,
			[
				{
					chainId: 10,
					dexName: 'UniswapV2',
					feesBPS: 0.003,
					routerAddress: UNISWAP_V2_ROUTER_ADDRESSES.get(10) as `0x${string}`,
				},
				{
					chainId: 8453,
					dexName: 'UniswapV2',
					feesBPS: 0.003,
					routerAddress: UNISWAP_V2_ROUTER_ADDRESSES.get(8453) as `0x${string}`,
				},
			],
		],
	]);
	// Setting up our Executor and its event listeners

	const executor = new Executor(tokensAndInstances, ARBITRAGEOUR_ACCOUNT);

	logger.info('Executor Initialized.');
	executor.setup();

	// sleeping to make sure executor has enough time to set up listeners
	await sleep(3000);

	logger.info('Executor listeners started.');

	// add liquidity on both chains to simulate arbitrage

	const addLiquidityOptimismHash = await addLiquidity(
		AMOUNT_LIQUIDITY_ETH,
		tokenAddress,
		AMOUNT_LIQUIDITY_TOKEN,
		10,
		DEPLOYER_ACCOUNT,
	);

	if (!addLiquidityOptimismHash) {
		return;
	}

	logger.info(
		`Added ${formatEther(AMOUNT_LIQUIDITY_ETH)} ETH and ${formatEther(AMOUNT_LIQUIDITY_TOKEN)} tokens to Uni V2 Liquidity on Optimism. TX: ${addLiquidityOptimismHash}`,
	);

	const addLiquidityBaseHash = await addLiquidity(
		AMOUNT_LIQUIDITY_ETH,
		tokenAddress,
		AMOUNT_LIQUIDITY_TOKEN,
		8453,
		DEPLOYER_ACCOUNT,
	);

	if (!addLiquidityBaseHash) {
		return;
	}

	logger.info(
		`Added ${formatEther(AMOUNT_LIQUIDITY_ETH)} ETH and ${formatEther(AMOUNT_LIQUIDITY_TOKEN)} tokens to Uni V2 Liquidity on Base. TX: ${addLiquidityBaseHash}`,
	);

	// Simulating a large buy on optimism to trigger an arbitrage oppurtunity.
	// Our executor has a background process that will listen to the event triggrered by this buy, and perform a cross chain arbitrage.

	const simulateBuyHash = (await buy(
		optimismWalletClient,
		SIMULATE_BUY_ACCOUNT,
		SIMULATE_BUY_AMOUNT,
		tokenAddress,
		10,
	)) as `0x${string}`;

	if (!simulateBuyHash) {
		return;
	}

	logger.info(
		`Simulated a buy of ${formatEther(SIMULATE_BUY_AMOUNT)} ETH on Optimism. TX: ${simulateBuyHash}`,
	);
};

SuperchainArbitrage();
