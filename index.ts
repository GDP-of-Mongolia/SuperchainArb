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