/**
 * we want to be able to calculate if there is arb opp between two pairs. If there is we will output the ideal position size and other info.
 * we will wrap this in a seperate function that naively would iterate through all pairs of liq pairs and check if there is an arb opp.
 * less naively we can just check if there is an arb opp between the pair we have received a trading event for and every other pair.
 */

import { formatEther, parseEther } from "viem";
import { getAmountOut } from "./uniswapv2";

// Define our interfaces

export interface V2Instance {
  chainId: number;
  dexName?: string;
  feesBPS: number;
}

export interface V2PoolReservesUpdate {
  token0: `0x${string}`;
  token1: `0x${string}`;
  weth: 0 | 1;
  reserve0: bigint; // e.g. amount of ETH if token0 is ETH
  reserve1: bigint; // e.g. amount of tokenA
  v2Instance: V2Instance;
}

interface BridgeSuperchainERC20Ins {
  fromChainID: number;
  toChainID: number;
  ca: `0x${string}`;
  amount: bigint;
}

interface BridgeSuperchainWETHIns {
  fromChainID: number;
  toChainID: number;
  amount: bigint;
}

// assuming swapExactETHForTokens
interface SwapV2Ins {
  v2Instance: V2Instance;
  path: `0x${string}`[]; // length 2 for testing
  amountIn: bigint; // ETH amount
  minAmountOut: bigint;
}

type V2ArbPathInstruction = BridgeSuperchainERC20Ins | SwapV2Ins | BridgeSuperchainWETHIns;

export type V2ArbOppurtityResult = V2ArbExecution | null;

export interface V2ArbExecution {
  instructions: V2ArbPathInstruction[];
  estimatedProfit: bigint;
}

/**
 * 
 */
export const evaluateV2ArbOppurtunity = (
  updateOne: V2PoolReservesUpdate,
  updateTwo: V2PoolReservesUpdate
): V2ArbOppurtityResult => {
  // assuming the fees are the same for now
  // assuming the tokens have 18 decimals
  // Double check bigint and number logic
  // assuming the tokens are the same
  const ethReserveA = updateOne.weth === 0 ? updateOne.reserve0 : updateOne.reserve1;
  const ethReserveANum = Number(formatEther(ethReserveA));

  const ethReserveB = updateTwo.weth === 0 ? updateTwo.reserve0 : updateTwo.reserve1;
  const ethReserveBNum = Number(formatEther(ethReserveB));

  const tokenReserveA = updateOne.weth === 0 ? updateOne.reserve1 : updateOne.reserve0;
  const tokenReserveANum = Number(formatEther(tokenReserveA));
  const tokenReserveB = updateTwo.weth === 0 ? updateTwo.reserve1 : updateTwo.reserve0;
  const tokenReserveBNum = Number(formatEther(tokenReserveB));

  const fees = updateOne.v2Instance.feesBPS;

  const c = (ethReserveANum * tokenReserveBNum) ** (ethReserveANum * tokenReserveBNum) - (1 - fees) * (1 - fees) * tokenReserveANum * tokenReserveBNum * ethReserveANum * ethReserveBNum;
  const k = (1 - fees) * tokenReserveBNum + (1 - fees) * (1 - fees) * tokenReserveANum;
  const b = 2 * k * ethReserveANum * tokenReserveBNum;
  const a = k * k;
  const idealAmountInNum = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);

  const idealAmountIn = parseEther(idealAmountInNum.toString());

  const amountTokenOutChainA = getAmountOut(idealAmountIn, ethReserveA, tokenReserveA, updateOne.v2Instance.feesBPS);
  const amountETHOutChainB = getAmountOut(amountTokenOutChainA, tokenReserveB, ethReserveB, updateTwo.v2Instance.feesBPS);

  const estimatedProfit = amountETHOutChainB - idealAmountIn;

  if (estimatedProfit > 0) {
    return {
      instructions: [
        {
          v2Instance: updateOne.v2Instance,
          amountIn: idealAmountIn,
          minAmountOut: 0n,
          path: updateOne.weth === 0 ? [updateOne.token0, updateOne.token1] : [updateOne.token1, updateOne.token0],
        },
        {
          fromChainID: updateOne.v2Instance.chainId,
          toChainID: updateTwo.v2Instance.chainId,
          ca: updateOne.weth === 0 ? updateOne.token1 : updateOne.token0,
          amount: amountTokenOutChainA,
        },
        {
          v2Instance: updateTwo.v2Instance,
          path: updateTwo.weth === 0 ? [updateTwo.token1, updateTwo.token0] : [updateTwo.token0, updateTwo.token1],
          amountIn: amountTokenOutChainA,
          minAmountOut: 0n,
        },
        {
          fromChainID: updateTwo.v2Instance.chainId,
          toChainID: updateOne.v2Instance.chainId,
          amount: amountETHOutChainB,
        },
      ],
      estimatedProfit
    }
  }

  return null;
};

