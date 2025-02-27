// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Predeploys } from '@eth-optimism/contracts-bedrock/src/libraries/Predeploys.sol';
import { IL2ToL2CrossDomainMessenger } from '@eth-optimism/contracts-bedrock/interfaces/L2/IL2ToL2CrossDomainMessenger.sol';
import { ISuperchainTokenBridge } from '@eth-optimism/contracts-bedrock/interfaces/L2/ISuperChainTokenBridge.sol';
import { ISuperchainWETH } from '@eth-optimism/contracts-bedrock/interfaces/L2/ISuperChainWETH.sol';
import { IL2ToL2CrossDomainMessenger } from '@eth-optimism/contracts-bedrock/interfaces/L2/IL2ToL2CrossDomainMessenger.sol';
import { PredeployAddresses } from '@interop-lib/libraries/PredeployAddresses.sol';
import { CrossDomainMessageLib } from '@interop-lib/libraries/CrossDomainMessageLib.sol';

interface IUniswapV2Router02 {
	function swapExactETHForTokens(
		uint amountOutMin,
		address[] calldata path,
		address to,
		uint deadline
	) external payable returns (uint[] memory amounts);

	function swapExactTokensForETH(
		uint amountIn,
		uint amountOutMin,
		address[] calldata path,
		address to,
		uint deadline
	) external returns (uint[] memory amounts);
}

contract SwapAndBridge {
	ISuperchainTokenBridge bridgeInterface =
		ISuperchainTokenBridge(PredeployAddresses.SUPERCHAIN_TOKEN_BRIDGE);

	ISuperchainWETH wethInterface = ISuperchainWETH(PredeployAddresses.SUPERCHAIN_WETH);

	// Do we have some sort of mapping to get the router address
	IUniswapV2Router02 routerInterface = IUniswapV2Router02();

	IL2toL2CrossDomainMessenger messengerInterface =
		IL2toL2CrossDomainMessenger(PredeployAddresses.L2_TO_L2_CROSS_DOMAIN_MESSENGER);

	function SwapAndBridge(
		address owner,
		address token,
		address recipient,
		uint256 amount,
		uint256 originChainId,
		uint256 destinationChainId,
		address originRouterV2,
		address destRouterV2,
		address destContract
	) external {
		IUniswapV2Router02 originRouter = IUniswapV2Router02(originRouterV2);

		IUniswapV2Router02 destRouter = IUniswapV2Router02(destRouterV2);

		// Transfer tokenIn from the caller to this contract.
		require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amount), 'Transfer failed');

		// Approve the Uniswap router to spend tokenIn.
		require(IERC20(tokenIn).approve(address(this), amountIn), 'Approval failed');

		uint[] memory amounts1 = originRouter.swapExactETHForTokens();

		uint256 swappedAmount = amounts[amounts.length - 1];

		require(swappedAmount > 0, 'Swap returned zero tokens');

		bytes32 msgHash = bridgeInterface.sendERC20(token, recipient, amount, destinationChainId);

		// uint[] memory amounts2 = destRouter.swapExactTokensForETH()

		// send a message to chain B to swap the tokens on arrival, and also bridge them back
		// this will be in the form of data,

		// For example, assume the destination contract has a function:
		// We encode the call data accordingly:
		bytes memory messageData = abi.encodeWithSelector(
			bytes4(
				keccak256(
					'SwapAndBridgeBack(address,address,addresss,uint256,uint256,uint256,address,address,address,bytes32)'
				)
			),
			recepient,
			token,
			owner,
			destinationChainID,
			originChainID,
			destRouterV2,
			originRouterV2,
			msgHash
		);

		messengerInterface.sendMessage(destinationChainId, destContract, message);
	}

	function SwapAndBridgeBack(
		address owner,
		address token,
		address recipient,
		uint256 amount,
		uint256 originChainId,
		uint256 destinationChainId,
		address originRouterV2,
		address destRouterV2,
		address destContract,
		bytes32 _sendHash
	) external {
		CrossDomainMessageLib.requireCrossDomainCallback(); // what does this do. it was in the example code

		// CrossDomainMessageLib.requireMessageSuccess uses a special error signature that the
		// auto-relayer performs special handling on. The auto-relayer parses the _sendWethMsgHash
		// and waits for the _sendWethMsgHash to be relayed before relaying this message.
		CrossDomainMessageLib.requireMessageSuccess(_sendHash);

		IUniswapV2Router02 originRouter = IUniswapV2Router02(originRouterV2);

		IUniswapV2Router02 destRouter = IUniswapV2Router02(destRouterV2);

		uint[] memory amounts1 = originRouter.swapExactTokensForETH();

		uint256 swappedAmount = amounts[amounts.length - 1];

		require(swappedAmount > 0, 'Swap returned zero tokens');

		bytes32 msgHash = wethBridge.sendWETH{ value: swappedAmount }(
			recipient,
			destinationChainID
		);

		// uint[] memory amounts2 = destRouter.swapExactTokensForETH()

		// send a message to chain B to swap the tokens on arrival, and also bridge them back
		// this will be in the form of data,
	}
}
