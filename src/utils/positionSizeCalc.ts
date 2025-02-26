/**
 * Calculate the optimal trade size that maximizes expected profit given a market impact model.
 *
 * Expected Profit(x) = (sellPrice - buyPrice) * x - c * (x / liquidity)^alpha
 *
 * Solving d/dx ExpectedProfit(x) = 0 yields:
 *   x = [ (sellPrice - buyPrice) * liquidity^alpha / (c * alpha) ]^(1/(alpha-1))
 *
 * @param sellPrice - The price on the expensive chain (where you sell).
 * @param buyPrice - The price on the cheaper chain (where you buy).
 * @param liquidity - The liquidity available on the buying side (reserve of token0).
 * @param c - The market impact coefficient.
 * @param alpha - The market impact exponent.
 * @param riskLimit - The maximum trade size allowed (risk limit).
 * @returns The optimal trade size (clipped to the risk limit).
 */
export function calculateOptimalTradeSize(
  sellPrice: number,
  buyPrice: number,
  liquidity: number,
  c: number,
  alpha: number,
  riskLimit: number
): number {
  const delta = sellPrice - buyPrice;
  if (delta <= 0) {
    // No arbitrage opportunity if sell price isn't greater than buy price.
    return 0;
  }

  // Compute the raw optimal trade size using the derived formula:
  // x = ((delta * liquidity^alpha) / (c * alpha))^(1/(alpha - 1))
  const numerator = delta * Math.pow(liquidity, alpha);
  const denominator = c * alpha;
  const exponent = 1 / (alpha - 1); // Note: If alpha < 1, exponent is negative.
  const rawTradeSize = Math.pow(numerator / denominator, exponent);

  // Clip the raw trade size to the risk limit.
  const optimalTradeSize = Math.min(rawTradeSize, riskLimit);
  return optimalTradeSize;
}

// ----- Example Usage -----

// Suppose our parameters are as follows:
const sellPrice = 105;          // e.g., selling at 105 (in some price unit)
const buyPrice = 100;           // buying at 100
const liquidity = 1e6;          // liquidity of 1,000,000 (in token0 units, e.g., ETH in wei-scale)
const c = 0.0001;               // market impact coefficient (tuned by historical data)
const alpha = 0.5;              // typical market impact exponent (between 0 and 1)
const riskLimit = 10000;        // risk limit (max trade size)

const optimalSize = calculateOptimalTradeSize(sellPrice, buyPrice, liquidity, c, alpha, riskLimit);
console.log(`Optimal trade size: ${optimalSize}`);
