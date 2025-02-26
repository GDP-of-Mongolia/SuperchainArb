/**
 * we want to be able to calculate if there is arb opp between two pairs. If there is we will output the ideal position size and other info.
 * we will wrap this in a seperate function that naively would iterate through all pairs of liq pairs and check if there is an arb opp.
 * less naively we can just check if there is an arb opp between the pair we have received a trading event for and every other pair.
 */

import { priceData, type PriceUpdate } from "./monitor";

// Define our interfaces

export interface V2PoolReservesUpdate {
  token0: `0x${string}`;
  token1: `0x${string}`;
  reserve0: bigint; // e.g. amount of ETH if token0 is ETH
  reserve1: bigint; // e.g. amount of tokenA
  chainId: number;
  dexName?: string;
}

export interface V2ArbOppurtityResult {
  opportunity: boolean;
  buyChainId?: number;     // Chain to buy from (cheaper price)
  sellChainId?: number;    // Chain to sell on (expensive price)
  buyPrice?: number;       // Price on the cheaper chain
  sellPrice?: number;      // Price on the expensive chain
  relativeDifference?: number; // Relative percentage difference between prices (e.g., 0.025 means 2.5%)
  optimalTradeSize?: bigint;   // Recommended trade size (in token0 units, e.g. ETH)
  expectedProfit?: number;     // A rough estimation (in token0 units)
  details?: string;
}

/**
 * Evaluates an arbitrage opportunity between two Uniswap V2 liquidity pools.
 *
 * The function computes the price on each pool using the formula:
 *    price = reserve1 / reserve0
 * It then compares the prices, and if the relative difference exceeds a threshold,
 * it recommends buying on the chain with the lower price and selling on the chain with the higher price.
 *
 * For a naïve recommendation, it uses 1% of the cheaper pool’s reserve0 as the optimal trade size.
 *
 * @param updateOne - The first pool's reserves update.
 * @param updateTwo - The second pool's reserves update.
 * @returns A V2ArbOppurtityResult object with details if an opportunity exists; otherwise, { opportunity: false }.
 */
export const evaluateV2ArbOppurtunity = (
  updateOne: V2PoolReservesUpdate,
  updateTwo: V2PoolReservesUpdate
): V2ArbOppurtityResult => {
  // Calculate prices from the reserves.
  // Price here is defined as: price = reserve1 / reserve0
  const priceOne = Number(updateOne.reserve1) / Number(updateOne.reserve0);
  const priceTwo = Number(updateTwo.reserve1) / Number(updateTwo.reserve0);

  // Use a threshold for minimum relative difference (e.g., 2%)
  const THRESHOLD = 0.02;
  const avgPrice = (priceOne + priceTwo) / 2;
  const relativeDiff = Math.abs(priceOne - priceTwo) / avgPrice;

  // If the price difference is below threshold, no opportunity exists.
  if (relativeDiff < THRESHOLD) {
    return { opportunity: false };
  }

  // Determine which update offers the cheaper price.
  let buyUpdate: V2PoolReservesUpdate, sellUpdate: V2PoolReservesUpdate;
  let buyPrice: number, sellPrice: number;
  if (priceOne < priceTwo) {
    buyUpdate = updateOne;
    sellUpdate = updateTwo;
    buyPrice = priceOne;
    sellPrice = priceTwo;
  } else {
    buyUpdate = updateTwo;
    sellUpdate = updateOne;
    buyPrice = priceTwo;
    sellPrice = priceOne;
  }

  // For a naïve estimate, choose an optimal trade size as 1% of the cheaper pool's reserve0.
  const optimalTradeSize = BigInt(Math.floor(Number(buyUpdate.reserve0) * 0.01));

  // Estimate profit (for small trades, profit ≈ (sellPrice - buyPrice) * trade size).
  // Here, we use the trade size in terms of token0 units.
  const expectedProfit = (sellPrice - buyPrice) * Number(optimalTradeSize);

  return {
    opportunity: true,
    buyChainId: buyUpdate.chainId,
    sellChainId: sellUpdate.chainId,
    buyPrice,
    sellPrice,
    relativeDifference: relativeDiff,
    optimalTradeSize,
    expectedProfit,
    details: `Buy at ${buyPrice} on chain ${buyUpdate.chainId} and sell at ${sellPrice} on chain ${sellUpdate.chainId}.`,
  };
};

// Example usage:
//
// Suppose you have two updates from different chains/DEXs:
//
// const updateA: V2PoolReservesUpdate = {
//   token0: "0xToken0Address",
//   token1: "0xToken1Address",
//   reserve0: 1000n, // e.g. 1000 ETH (in wei)
//   reserve1: 2000000n, // e.g. 2,000,000 units of tokenA
//   chainId: 901,
//   dexName: "UniswapV2-A",
// };
//
// const updateB: V2PoolReservesUpdate = {
//   token0: "0xToken0Address",
//   token1: "0xToken1Address",
//   reserve0: 1000n,
//   reserve1: 2100000n, // Slightly higher price: 2100000 / 1000 = 2100 vs. 2000
//   chainId: 902,
//   dexName: "UniswapV2-B",
// };
//
// const result = evaluateV2ArbOppurtunity(updateA, updateB);
// console.log(result);
//
// If the relative difference exceeds the threshold, the result will include details such as the ideal trade size and estimated profit.





// my preferred way of doing it


// --- Arbitrage Detector ---
/**
 * Processes price updates from various chains.
 * Consolidates the latest prices and checks if an arbitrage opportunity exists.
 *
 * @param update - The price update containing the rpcUrl and computed price.
 */
export function processPriceUpdate(update: PriceUpdate) {
  // Update our stored price.
  priceData[update.rpcUrl] = update.price;
  console.log("Current consolidated prices:", priceData);

  // Require at least two chains to compare.
  const rpcUrls = Object.keys(priceData);
  if (rpcUrls.length < 2) {
    console.log("Waiting for price data from at least 2 chains...");
    return;
  }

  // Determine the chain with the minimum and maximum price.
  let minRpcUrl = rpcUrls[0];
  let maxRpcUrl = rpcUrls[0];
  for (const url of rpcUrls) {
    if (priceData[url] < priceData[minRpcUrl]) {
      minRpcUrl = url;
    }
    if (priceData[url] > priceData[maxRpcUrl]) {
      maxRpcUrl = url;
    }
  }

  const minPrice = priceData[minRpcUrl];
  const maxPrice = priceData[maxRpcUrl];

  // Define a threshold for arbitrage opportunity (e.g., 2% difference).
  const threshold = 0.02;
  const relativeDiff = (maxPrice - minPrice) / ((maxPrice + minPrice) / 2);
  console.log(
    `Comparing prices: min ${minPrice} at ${minRpcUrl}, max ${maxPrice} at ${maxRpcUrl} (relative diff: ${relativeDiff})`
  );

  // For a naïve estimate, choose an optimal trade size as 1% of the cheaper pool's reserve0.
  const optimalTradeSize = BigInt(Math.floor(Number(maxRpcUrl) * 0.01));

  if (relativeDiff >= threshold) {
    console.log("Arbitrage opportunity detected!");
    // Trigger the arbitrage execution using the chain with the lower price.
    executeArbitrage(minRpcUrl, maxRpcUrl, minPrice, maxPrice);
  } else {
    console.log("No significant arbitrage opportunity detected.");
  }
}