// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from 'lib/forge-std/src/Script.sol';
import { Vm } from 'lib/forge-std/src/Vm.sol';
import { L2NativeSuperchainERC20 } from './L2NativeSuperchainERC20.sol';

import { SwapAndBridge } from './BridgeSwap.sol';

contract SuperchainERC20Deployer is Script {
	string deployConfig;

	constructor() {
		string memory deployConfigPath = vm.envOr(
			'DEPLOY_CONFIG_PATH',
			string('./deploy-config.toml')
		);
		//string memory filePath = string.concat(vm.projectRoot(), deployConfigPath);
		string memory filePath = deployConfigPath;
		deployConfig = vm.readFile(filePath);
	}

	/// @notice Modifier that wraps a function in broadcasting.
	modifier broadcast() {
		vm.startBroadcast(msg.sender);
		_;
		vm.stopBroadcast();
	}

	function setUp() public {}

	function run() public {
		string[] memory chainsToDeployTo = vm.parseTomlStringArray(
			deployConfig,
			'.deploy_config.chains'
		);

		address deployedAddress;
		address ownerAddr;
		address bridgeAddress;

		for (uint256 i = 0; i < chainsToDeployTo.length; i++) {
			string memory chainToDeployTo = chainsToDeployTo[i];

			console.log('Deploying to chain: ', chainToDeployTo);

			vm.createSelectFork(chainToDeployTo);
			(address _deployedAddress, address _ownerAddr) = deployL2NativeSuperchainERC20();
			address _bridgeAddress = deployBridgeSwap(ownerAddr);
			deployedAddress = _deployedAddress;
			bridgeAddress = _bridgeAddress;
			ownerAddr = _ownerAddr;
		}

		outputDeploymentResult(deployedAddress, bridgeAddress, ownerAddr);
	}

	function deployL2NativeSuperchainERC20()
		public
		broadcast
		returns (address addr_, address ownerAddr_)
	{
		ownerAddr_ = vm.parseTomlAddress(deployConfig, '.token.owner_address');
		string memory name = vm.parseTomlString(deployConfig, '.token.name');
		string memory symbol = vm.parseTomlString(deployConfig, '.token.symbol');
		uint256 decimals = vm.parseTomlUint(deployConfig, '.token.decimals');

		require(decimals <= type(uint8).max, 'decimals exceeds uint8 range');
		bytes memory initCode = abi.encodePacked(
			type(L2NativeSuperchainERC20).creationCode,
			abi.encode(ownerAddr_, name, symbol, uint8(decimals))
		);
		address preComputedAddress = vm.computeCreate2Address(_implSalt(), keccak256(initCode));
		if (preComputedAddress.code.length > 0) {
			console.log(
				'L2NativeSuperchainERC20 already deployed at %s',
				preComputedAddress,
				'on chain id: ',
				block.chainid
			);
			addr_ = preComputedAddress;
		} else {
			addr_ = address(
				new L2NativeSuperchainERC20{ salt: _implSalt() }(
					ownerAddr_,
					name,
					symbol,
					uint8(decimals)
				)
			);
			console.log(
				'Deployed L2NativeSuperchainERC20 at address: ',
				addr_,
				'on chain id: ',
				block.chainid
			);
		}
	}

	function deployBridgeSwap(address ownerAddr_) public broadcast returns (address addr_) {
		// Encode constructor arguments
		bytes memory initCode = type(SwapAndBridge).creationCode;

		// Compute the deterministic deployment address using CREATE2
		address preComputedAddress = vm.computeCreate2Address(_implSalt(), keccak256(initCode));

		// Check if the contract is already deployed
		if (preComputedAddress.code.length > 0) {
			console.log('SwapAndBridge already deployed at %s', preComputedAddress);
			addr_ = preComputedAddress;
		} else {
			// Deploy the contract using CREATE2
			addr_ = address(new SwapAndBridge{ salt: _implSalt() }());
			console.log('Deployed SwapAndBridge at address: ', addr_);
		}
	}

	function outputDeploymentResult(
		address deployedAddress,
		address bridgeAddress,
		address ownerAddr
	) public {
		console.log('Outputting deployment result');

		string memory obj = 'result';
		vm.serializeAddress(obj, 'deployedAddress', deployedAddress);
		vm.serializeAddress(obj, 'bridgeAddress', deployedAddress);
		string memory jsonOutput = vm.serializeAddress(obj, 'ownerAddress', ownerAddr);

		vm.writeJson(jsonOutput, 'deployment.json');
	}

	/// @notice The CREATE2 salt to be used when deploying the token.
	function _implSalt() internal view returns (bytes32) {
		string memory salt = vm.parseTomlString(deployConfig, '.deploy_config.salt');
		return keccak256(abi.encodePacked(salt));
	}
}
