// What do you need for the whole executor
// 1. Set up supersim
// 2. Set up environment
// 3. Deploy SuperchainERC20 on all applicable pools(i.e. on 2 chains for our use case basically)
// 4. Add Liquidity to the pools on all chains( again, 2 chains for our use case)
// 5. Startup Listener, which monitors price discrepancy
// 6. Ape into one of the pools with ETH (code pending)
// 7. Listener code detects sync event, calls check. Check passes
// 8. execute code called, which basically calls the smart contract to do both the swap and bridge, on both chains. (code pending)
// 9. Once, the arb is completed, we would like to generate a log or recording of the arb buy price, the chains, sell price.


// what other data would we want logged or recorded?
// 1. What the expected arb was, our projected buy price and sell price.
// 2. Actual arb details, buy execution price, sell execution price.

// What optimisations could we make, given the time?
