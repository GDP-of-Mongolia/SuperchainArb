import {
	createPublicClient,
	createWalletClient,
	http,
	erc20Abi,
	type PrivateKeyAccount,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
	DEADLINE,
	PRIVATE_KEY,
	PUBLIC_KEY,
	chainIDToRPCUrls,
	chainIDtoChain,
} from '../config/config';
import type { WalletClient, PublicClient } from 'viem';
import { ROUTER_V2_ABI } from '../constants/abi/ABIs';
import { UNISWAP_V2_ROUTER_ADDRESSES } from '../constants/addresses';
import { publicActionsL2, walletActionsL2 } from '@eth-optimism/viem';

export const addLiquidity = async (
	amountEth: bigint,
	token: `0x${string}`,
	amountToken: bigint,
	chainId: number,
	account: PrivateKeyAccount,
) => {
	const walletClient = createWalletClient({
		transport: http(chainIDToRPCUrls.get(chainId) as string),
		chain: chainIDtoChain.get(chainId),
	}).extend(walletActionsL2());

	const publicClient = createPublicClient({
		transport: http(chainIDToRPCUrls.get(chainId) as string),
		chain: chainIDtoChain.get(chainId),
	}).extend(publicActionsL2());

	try {
		// Approve add liquidity
		const routerV2Address = UNISWAP_V2_ROUTER_ADDRESSES.get(walletClient.chain?.id as number);

		if (!routerV2Address) {
			return;
		}

		const approveAddLiquidityHash = await walletClient.writeContract({
			abi: erc20Abi,
			address: token as `0x${string}`,
			functionName: 'approve',
			args: [
				routerV2Address,
				115792089237316195423570985008687907853269984665640564039457584007913129639935n,
			],
			nonce: 1,
			gas: 100000n,
			chain: walletClient.chain,
			account: account,
		});

		const approveAddLiquidityReceipt = await publicClient.waitForTransactionReceipt({
			hash: approveAddLiquidityHash,
		});

		const { request, result } = await publicClient.simulateContract({
			account: PUBLIC_KEY,
			address: routerV2Address,
			abi: ROUTER_V2_ABI,
			functionName: 'addLiquidityETH',
			args: [
				token as `0x${string}`,
				amountToken,
				amountToken,
				amountEth,
				PUBLIC_KEY,
				BigInt(DEADLINE),
			],
			value: amountEth,
			// nonce: 2,
			gas: 3000000n,
		});

		const liquidityBalance = result;

		const addLiquidityHash = await walletClient.writeContract(request);
		return addLiquidityHash;
	} catch (error: any) {
		console.error('Error adding liquidity:', error);
		return null;
	}
};
