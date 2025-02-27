// ADD LIQUIDITY FUNCTION



export const getAmountOut = (amountIn: bigint, reserveIn: bigint, reserveOut: bigint, fees: number): bigint => {
    const feesBips = fees * 100;
    const amountInWithFee = amountIn * BigInt(1000 - feesBips);
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * BigInt(1000) + amountInWithFee;
    const amountOut = numerator / denominator;
    return amountOut;
}