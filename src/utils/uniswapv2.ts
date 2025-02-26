// add liquidity

// swap
/**
 * how do we ensure sufficient gas?
 * check percentage of account balance left after each transaction?
 * @param account 
 * @param proportion 
 */
const buy = async (account: PrivateKeyAccount, proportion: number) => {
    await waitForPending(account.address);
    const ethBalance = accountBalances.get(account.address)!.eth;
    const bigIntProportion = BigInt(Math.round(proportion * 1000));;
    const buyAmount = ethBalance * bigIntProportion / 1000n;

    // later done in prepare()
    const buyPath = WETH_ADDRESS_BASE < tokenAddress ? [WETH_ADDRESS_BASE, tokenAddress] : [tokenAddress, WETH_ADDRESS_BASE];

    const { request, result } = await VIEM_CLIENT.simulateContract({
        address: ROUTER_V2_ADDRESS,
        abi: ROUTER_V2_ABI,
        functionName: 'swapExactETHForTokens',
        args: [1n, buyPath, account.address, BigInt(DEADLINE)],
        value: buyAmount,
        account: account,
        gas: 500000n
    });
    const txHash = await WALLET_CLIENT.writeContract(request);
    updateBalances(account.address, VIEM_CLIENT.getBalance({ address: account.address }), VIEM_CLIENT.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address]
    }
    ));
    addToTransactionQueue(account.address, txHash);
    return {
        txHash,
        ethAmount: buyAmount,
        tokenAmount: result[1]
    };
}


const sell = async (account: PrivateKeyAccount, proportion: number) => {
    await waitForPending(account.address);
    const tokenBalance = accountBalances.get(account.address)!.token;
    const bigIntProportion = BigInt(Math.round(proportion * 1000));;
    const sellAmount = tokenBalance * bigIntProportion / 1000n;
    const sellPath = WETH_ADDRESS_BASE < tokenAddress ? [tokenAddress, WETH_ADDRESS_BASE] : [WETH_ADDRESS_BASE, tokenAddress];
    const { request, result } = await VIEM_CLIENT.simulateContract({
        address: ROUTER_V2_ADDRESS,
        abi: ROUTER_V2_ABI,
        functionName: 'swapExactTokensForETH',
        args: [sellAmount, 1n, sellPath, account.address, BigInt(DEADLINE)],
        account: account,
        gas: 500000n
    });
    const txHash = await WALLET_CLIENT.writeContract(request);
    updateBalances(account.address, VIEM_CLIENT.getBalance({ address: account.address }), VIEM_CLIENT.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address]
    }
    ));
    addToTransactionQueue(account.address, txHash);
    return {
        txHash,
        ethAmount: result[1],
        tokenAmount: sellAmount
    };
}
