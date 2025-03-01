// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Predeploys } from 'lib/eth-optimism-contracts-bedrock/packages/contracts-bedrock/src/libraries/Predeploys.sol';
import { ISuperchainTokenBridge } from 'lib/eth-optimism-contracts-bedrock/packages/contracts-bedrock/interfaces/L2/ISuperChainTokenBridge.sol';
import { ISuperchainWETH } from 'lib/eth-optimism-contracts-bedrock/packages/contracts-bedrock/interfaces/L2/ISuperChainWETH.sol';
import { IL2ToL2CrossDomainMessenger } from 'lib/eth-optimism-contracts-bedrock/packages/contracts-bedrock/interfaces/L2/IL2ToL2CrossDomainMessenger.sol';
import { CrossDomainMessageLib } from 'lib/interop-lib/src/libraries/CrossDomainMessageLib.sol';

import { IERC20 } from 'lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol';

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
		ISuperchainTokenBridge(Predeploys.SUPERCHAIN_TOKEN_BRIDGE);

	ISuperchainWETH wethInterface = ISuperchainWETH(payable(Predeploys.SUPERCHAIN_WETH));

	IL2ToL2CrossDomainMessenger messengerInterface =
		IL2ToL2CrossDomainMessenger(Predeploys.L2_TO_L2_CROSS_DOMAIN_MESSENGER);

	function swapAndBridge(
		address ethAddress,
		address owner,
		address token,
		uint256 amount,
		uint256 originChainId,
		uint256 destinationChainId,
		address originRouterV2,
		address destRouterV2,
		address destContract
	) external payable {
		IUniswapV2Router02 originRouter = IUniswapV2Router02(originRouterV2);

		address[] memory path = new address[](2);
		path[0] = ethAddress;
		path[1] = token;

		uint256 contractBalance = address(this).balance;
		require(contractBalance >= amount, 'Not enough ETH balance in contract');

		uint[] memory amounts = originRouter.swapExactETHForTokens{ value: amount }(
			0,
			path,
			address(this),
			2000000000
		);

		uint256 swappedAmount = amounts[amounts.length - 1];

		require(swappedAmount > 0, 'Swap returned zero tokens');

		bytes32 msgHash = bridgeInterface.sendERC20(
			token,
			destContract,
			swappedAmount,
			destinationChainId
		);

		// We encode the call data accordingly:
		bytes memory messageData = abi.encodeWithSelector(
			this.SwapAndBridgeBack.selector,
			ethAddress,
			token,
			owner,
			swappedAmount,
			originChainId,
			destRouterV2,
			msgHash
		);

		messengerInterface.sendMessage(destinationChainId, destContract, messageData);
	}

	function SwapAndBridgeBack(
		address ethAddress,
		address token,
		address recipient,
		uint256 amount,
		uint256 destinationChainId,
		address originRouterV2,
		bytes32 _sendHash
	) external payable {
		// CrossDomainMessageLib.requireCrossDomainCallback();

		// CrossDomainMessageLib.requireMessageSuccess uses a special error signature that the
		// auto-relayer performs special handling on. The auto-relayer parses the _sendWethMsgHash
		// and waits for the _sendWethMsgHash to be relayed before relaying this message.
		CrossDomainMessageLib.requireMessageSuccess(_sendHash);

		IUniswapV2Router02 originRouter = IUniswapV2Router02(originRouterV2);

		// Ensure the contract holds enough tokens to proceed
		uint256 tokenBalance = IERC20(token).balanceOf(address(this));
		require(tokenBalance >= amount, 'Not enough tokens in the contract');

		address[] memory path = new address[](2);
		path[0] = token;
		path[1] = ethAddress;

		IERC20(token).approve(originRouterV2, amount);

		uint[] memory amounts = originRouter.swapExactTokensForETH(
			amount,
			0,
			path,
			address(this),
			2000000000
		);

		uint256 swappedAmount = amounts[amounts.length - 1];

		require(swappedAmount > 0, 'Swap returned zero tokens');

		wethInterface.sendETH{ value: swappedAmount }(recipient, destinationChainId);
	}
	receive() external payable {}
}
