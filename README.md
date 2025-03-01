# SuperchainArb

## Problem Statement

### Application characteristics:

The application:

- Integrates with the Superchain interop predeploys.
- Arbitrage bot that utilizes Superchain interop to profit from price differences across common DEX pools on different chains (e.g., ChainA and ChainB).

### Impact on OP Labs

Helping OP Labs by collaborating and working on Interop devnets to give feedback and improve the Superchain Interop ecosystem.

---

## Use Cases

1. **Cross-Chain Arbitrage:** A trader identifies and exploits price differences of the same token (e.g., ETH or SuperchainERC20 stablecoins) between DEX pools on ChainA and ChainB.
2. **Volatile Market Arbitrage:** During high volatility, token prices fluctuate rapidly between chains, creating arbitrage opportunities.
3. **Gas Optimization:** The bot ensures arbitrage transactions remain profitable by minimizing gas fees.

Category: **SuperArbitrage** – Leveraging the Superchain for profitable arbitrage.

---

## Repository Overview

This repository serves as a proof of concept demonstrating how Superchain Arbitrage can be achieved using Superchain ERC20 interop features.

### Dependencies Setup

To install the necessary dependencies, run:

```sh
bun install
```

---

## Steps to Run the Arbitrage Bot

### Step 1: Set Up Supersim Fork

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

### Step 2: Deploy ERC20 and BridgeSwap Contracts

```sh
bun run src/scripts/deploy
```

- Deployment configurations are stored in `deploy-config.toml`.
- Uses Foundry to enable the `SuperchainERC20.sol` script.
- The **Create2** mechanism ensures that both the ERC20 and `BridgeSwap` contracts are deployed at the same address on all chains.
- The deployed token address and bridge address are recorded in `deployment.json` and later read into `config.ts`.

### Step 3: Run the Main Simulation

```sh
bun run index.ts
```

- **Simulation Process:**
    1. Mints tokens and adds liquidity to pools on both chains.
    2. Creates and initializes an `executor` object.
    3. The `executor`:
        - Monitors `Sync` events in both pools.
        - Detects price discrepancies.
        - Computes the optimal arbitrage amount.
        - Executes the arbitrage transaction.
    4. To simulate a price discrepancy, we manually introduce a large, unexpected buy on one pool.

---

## Smart Contracts Overview

### `SwapAndBridge.sol`

- Swaps ETH for tokens on the first chain.
- Bridges the tokens to the second chain.
- Sends a cross-chain message via `L2ToL2DomainMessenger`, encoding calldata for `SwapAndBridgeBack`.

### `SwapAndBridgeBack.sol`

- Swaps the bridged tokens back into ETH on the second chain.
- Sends the ETH back to the original arbitrageur's address.

---

## Potential Optimizations

1. **Additional Chains:**
    - The system can be extended to support more chains beyond Base and Optimism.
2. **More DEX Integrations:**
    - Currently, we use Uniswap, but other DEX protocols (e.g., Sushiswap, Curve) could be added.
3. **Support for More Tokens:**
    - Expanding beyond ETH and SuperchainERC20 stablecoins would increase arbitrage opportunities.

---

## Conclusion

This project showcases the feasibility of **Superchain Arbitrage** by leveraging the Superchain's interop capabilities. By optimizing deployment, monitoring, and execution strategies, we enable profitable and gas-efficient arbitrage transactions across multiple chains. Future improvements can further enhance profitability and scalability.
