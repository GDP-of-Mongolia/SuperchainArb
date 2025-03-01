# SuperchainArb

---

**SuperArbitrage** – Leveraging the Superchain for profitable arbitrage.

## Repository Overview

This repository serves as a proof of concept demonstrating how Superchain Arbitrage can be achieved using Superchain ERC20 interop features.

**Cross-Chain Arbitrage:** The code identifies and exploits price differences of the same token (e.g., ETH or SuperchainERC20 tokens) between DEX pools on ChainA and ChainB.

### Dependencies Setup

Make sure you have `foundry` and `supersim` installed in order to run this repository.

To install the necessary dependencies, run:

```sh
bun install
```

The github submodules used have been included in the repo. Cloning the repository will take care of getting the necessary submodules, which are not yet available as published packages.

## Steps to Run the Arbitrage Bot

### Step 1: Set Up Supersim Fork

Since the interop functionality is not live on mainnet yet, we generate a fork of Supersim to help demonstrate the arbitrage.

Run the following command to start Supersim:

```sh
bun run src/scripts/startSupersim.ts
```

- In our example, we use **Base** and **Optimism** as the two chains.
- The private key used belongs to an account generated from the Supersim deploy.
- Additional chains can be added as needed.
- This command starts an instance of Supersim fork with:
    - **Forked Chains** (Base & Optimism)
    - **Interop and Autorelay Enabled**
- The flags that you desire to start up Supersim with can be modified in the `startSupersim.ts` file.

### Step 2: Build the contracts

Run the following forge command to build the contracts:

```sh
forge build --via-ir
```

- In case of changes to BridgeSwap.sol, the ABI constructed on running **forge build** will also change.
- Please remember to update the BrideSwap.ABI accordingly in that case by getting the ABI from the `out` folder generated.

### Step 3: Deploy ERC20 and BridgeSwap Contracts

```sh
bun run src/scripts/setUpEnvironment.ts
```

- Deployment configurations are stored in `deploy-config.toml`.
- You can set the following in the `deploy-config.toml` file:
    - chains you want to fork on
    - unique 'salt' used by CREATE2. We randomly append a number to the salt when running the set up script, to make testing less cumbersome.
    - owner_address, name, symbol and decimals of the token to be deployed.
- Uses Foundry to enable the `SuperchainERC20.sol` script.
- The **Create2** mechanism ensures that both the ERC20 and `BridgeSwap` contracts are deployed at the same address on all chains.
- The deployed token address and bridge address are recorded in `deployment.json` and later automatically read into `config.ts`.

### Step 4: Run the Main Simulation

```sh
bun run index.ts
```

- **Simulation Process:**
    1. Handles creation of `PublicClient` and `WalletClient` on all chains to allow us to pass them in the code later.
    2. Mints tokens and adds a certain amount liquidity to pools on both chains.
    3. Approves the `BRIDGE_SWAP_CONTRACT` for spending by the ARBITRAGEOUR_ACCOUNT.
    4. Initialises `tokensAndInstances` for better control of the configuration of the different chains.
    5. Creates and initializes an `executor` object.
    6. The `executor`:
        - Monitors `Sync` events in both pools.
        - Detects price discrepancies.
        - Computes the optimal arbitrage amount.
        - Executes the arbitrage transaction, if a profit is viable.
    7. To simulate a price discrepancy, we manually introduce a large buy on one pool using the `simulateBuy` function.

### Monitor process

- The `watchSyncEvents` function listens for the **Sync** event emitted on the chain mentioned and has a `onPriceUpdate` function which keeps track of the Pool changes.
- For each price update for a pool, we call the `evaluateArbV2Opportunity` function.

## Arbitrage Mathematics

Our goal is to calculate the **optimal input amount** (r) for arbitrage between two AMM pools.

### The Idea

1. **First Swap (Pool A):**  
   When you swap `dy₀` in Pool A, you get an output, denoted as $$dx$$, calculated by:

    $$dx = \frac{dy₀ \cdot (1-f) \cdot x_a}{y_a + dy₀ \cdot (1-f)}$$

    - **\(x_a\)**: Reserve out of AMM A (token reserve)
    - **\(y_a\)**: Reserve in of AMM A (ETH reserve)
    - **\(f\)**: Fee (e.g., 0.3% as 0.003)

2. **Second Swap (Pool B):**  
   Then, swapping $$dx$$ in Pool B gives you:

    $$dy₁ = \frac{dx \cdot (1-f) \cdot y_b}{x_b + dx \cdot (1-f)}$$

    - **\(x_b\)**: Reserve in of AMM B (token reserve)
    - **\(y_b\)**: Reserve out of AMM B (ETH reserve)

3. **Finding the Optimal Input:**  
   We define a function for net profit:

    $$f(dy₀) = dy₁ - dy₀$$

    Our goal is to find the value of $$dy₀$$ that maximizes this profit function. This is done by differentiating $$f(dy₀)$$ with respect to $$dy₀$$, setting the derivative to zero, and solving the resulting quadratic equation.

### The Formula

By solving the quadratic equation, we derive the optimal input amount $$r$$:

$$
r = \frac{-b + \sqrt{b^2 - 4ac}}{2a}
$$

where:

- $$k = (1-f) \cdot x_b + (1-f)^2 \cdot x_a$$

- $$a = k^2$$
- $$b = 2 \cdot k \cdot y_a \cdot x_b$$
- $$c = (y_a \cdot x_b)^2 - (1-f)^2 \cdot x_a \cdot y_b \cdot y_a \cdot x_b$$

### How It Maps to Our Code

In our `evaluateV2ArbOppurtunity` function, we calculate:

```ts
const c =
	(ethReserveANum * tokenReserveBNum) ** 2 -
	(1 - f) ** 2 * tokenReserveANum * tokenReserveBNum * ethReserveANum * ethReserveBNum;
const k = (1 - f) * tokenReserveBNum + (1 - f) ** 2 * tokenReserveANum;
const b = 2 * k * ethReserveANum * tokenReserveBNum;
const a = k * k;
const discriminant = b * b - 4 * a * c;
const idealAmountIn = (-b + Math.sqrt(discriminant)) / (2 * a);
```

---

## Smart Contracts Overview

This is where the magic pertaining to the swap and then **bridge across chains** takes place.

### `SwapAndBridge.sol`

- Called from `executeArb`
- Swaps ETH for tokens on the first chain (Chain A), using the Uniswap V2 Router interface.
- Bridges the tokens to the contract on the second chain (Chain B) using the'SuperchainERC20Bridge'.
- Since we have deployed the contract on the same address across chains, we dont need to remember the address separately.
- Sends a cross-chain message via `L2ToL2DomainMessenger` from Chain A to the contract on Chain B.
- The message encodes the calldata for `SwapAndBridgeBack`, allowing us to call it on Chain B. INTEROP MAKES THIS POSSIBLE!

### `SwapAndBridgeBack.sol`

- Ensures that the message for the SuperchainERC20 Transfer has been relayed and tokens have been received from Chain A.
- Approves the contract to spend the transferred tokens.
- Swaps the bridged tokens back into ETH on the second chain (chain B).
- Sends the ETH back to the original ARBITRAGEOUR_ACCOUNT using `sendETH` function in the SuperchainWETH interface.

---

## Potential Optimizations

1. **Additional Chains:**
    - The system can be extended to support more chains beyond Base and Optimism.
2. **More DEX Integrations:**
    - Currently, we use Uniswap, but other DEX protocols (e.g., Sushiswap, Curve) could be added.
3. **Support for More Tokens:**
    - Expanding beyond ETH and SuperchainERC20 stablecoins would increase arbitrage opportunities.

---

### Application characteristics:

The application:

- Integrates with the Superchain interop predeploys.
- Arbitrage bot that utilizes Superchain interop to profit from price differences across common DEX pools on different chains (e.g., ChainA and ChainB).

### Impact on OP Labs

Helping OP Labs by collaborating and working on Interop devnets to give feedback and improve the Superchain Interop ecosystem.

## Conclusion:

This project showcases the feasibility of **Superchain Arbitrage** by leveraging the Superchain's interop capabilities. By optimizing deployment, monitoring, and execution strategies, we enable profitable and gas-efficient arbitrage transactions across multiple chains. Future improvements can further enhance profitability and scalability.

```

```
