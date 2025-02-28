// write a flexible listener function that returns unwatch 
// function should work with multiple chains and uniswap V2 deployments
// we are mostly concerned with the Swap pair event
// consideration: do we want to listen to the pair directly, or do we want to listen to the router
// if we listen to the router, we would have to iterate each transactions logs to dig out the SWAP events
// at another