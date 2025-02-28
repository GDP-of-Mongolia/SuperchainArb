/**
 * 1. Start the supersim, fork chains [A, B, ..., N]
 * 2. deploy superchainERC20 token on chain A
 * 3. bridge ERC20 token from chain A to chains [B, ..., N]
 * 4. Determine amount of ETH liquidity to add on chains [A, B, ..., N]
 * 5. Set the ETH balance of account on chains [A, B, ..., N] to the determined amount for each chain.$
 * 6. Add liquidity to the superchainERC20 token on chains [A, B, ..., N]
 * 7. Deploy executor, which bundles the monitoring process, and the orders (transactions) to be placed, and a management/logging tool
 * 8. Simulate a "fat finger" buy on any one of the chains [A, B, ..., N]
 * 9. See if it executes, and log the result
 */

import { chainIDToPublicClient, chainIDToWalletClient } from "./src/config/config";
import { type PublicClient } from "viem"

import {
    contracts,
    publicActionsL2,
    walletActionsL2,
    createInteropSentL2ToL2Messages,
    decodeRelayedL2ToL2Messages,
} from "@eth-optimism/viem";

const optimismPublicClient = chainIDToPublicClient.get(10)?.extend(publicActionsL2());
const basePublicClient = chainIDToPublicClient.get(8453)?.extend(publicActionsL2());

const optimismWalletClient = chainIDToWalletClient.get(10)?.extend(walletActionsL2());
const baseWalletClient = chainIDToWalletClient.get(8453)?.extend(walletActionsL2());

const SuperchainArbitrage = () => {
    // start supersim

    // deploy serc20 token

    // bridge half of serc20 to chain B


    // add liquidity on both chains

    // deploy executor

    // fat finger buy on chain B
}

SuperchainArbitrage();