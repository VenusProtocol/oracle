# CLAUDE.md

Venus Protocol Oracle — Solidity smart contract project using Hardhat.

This is a DeFi protocol handling real funds. Always write clean, secure code — never apply quick patches or workarounds without understanding all side effects. Verify the impact of every change across the codebase. Every task deserves the same level of rigour; nothing should be treated as low priority or left at low quality. Never assume — if in doubt, ask and confirm before proceeding.

---

## Package Manager

Use **yarn** — never use npm.

```bash
yarn install                   # install dependencies
```

---

## Common Commands

```bash
yarn compile                   # compile contracts (regular + zksync)
yarn build                     # full build (tsc + hardhat compile + copy artifacts)
yarn test                      # compile + run all tests
npx hardhat test <file>        # run a specific test file
yarn lint                      # ESLint + Prettier + Solhint check
yarn prettier                  # auto-format code
yarn docgen                    # generate contract docs
```

### Fork Tests

```bash
# Requires FORK=true + FORKED_NETWORK + ARCHIVE_NODE_<network> in .env
FORK=true FORKED_NETWORK=bscmainnet npx hardhat test test/fork/<test-file>.ts
```

### Deploying

```bash
yarn deploy:testnet                                          # deploy to BSC testnet
yarn configure:testnet                                       # configure on BSC testnet
npx hardhat --network <network> deploy --tags <tag>         # targeted deploy
yarn verify                                                  # Etherscan verification
```

---

## File Structure

```
contracts/
  ├── interfaces/              # All contract interfaces
  ├── lib/                     # Shared libraries
  ├── oracles/                 # Individual oracle implementations
  │     └── common/            # Shared oracle base contracts
  ├── test/                    # Test-only contracts (mocks)
  ├── DeviationBoundedOracle.sol
  ├── ReferenceOracle.sol
  └── ResilientOracle.sol

test/
  ├── fork/                    # Fork-based integration tests (FORK=true)
  ├── utils/                   # Test helpers
  └── <OracleName>.ts          # Unit tests per oracle (mirrors contracts/oracles/)

deploy/                        # Hardhat-deploy scripts (numbered, run in order)
deployments/                   # Hardhat-deploy artifacts per network (git-tracked)
networks/                      # Network-specific deployment addresses (mainnet.json)
helpers/                       # TypeScript deployment helpers
artifacts/                     # Compiled ABIs & artifacts (NOT git-tracked)
```

---

## Tests

If tests exist and code changes are made: make the code change first, then immediately ask the user if you should update the tests before touching them.

---

## Architecture

### Oracle System

The core is `ResilientOracle.sol` — aggregates prices from up to 3 configured sources (MAIN, PIVOT, FALLBACK) per asset with `BoundValidator` deviation checks. Individual oracle contracts fetch prices from external sources (Chainlink, Binance, staking protocols, etc.).

### Key Contracts

- **`ResilientOracle.sol`** — Main entry point; routes price requests, applies bound validation
- **`BoundValidator.sol`** — Validates price deviation ratio between two oracle sources
- **`DeviationBoundedOracle.sol`** — Wraps an oracle and reverts if price deviates beyond threshold vs a reference
- **`ReferenceOracle.sol`** — Simple oracle wrapper for reference price comparison
- **`contracts/oracles/`** — All individual oracle implementations (Chainlink, Binance, OneJump, ERC4626, Pendle, LST/LRT oracles, etc.)

All oracle contracts implement `OracleInterface` (`getPrice(address asset)`).

### Supported Networks

Mainnets: `bscmainnet`, `ethereum`, `arbitrumone`, `opmainnet`, `opbnbmainnet`, `zksyncmainnet`, `basemainnet`, `unichainmainnet`

Testnets: `bsctestnet`, `sepolia`, `arbitrumsepolia`, `opsepolia`, `opbnbtestnet`, `zksyncsepolia`, `basesepolia`, `unichainsepolia`

ZkSync uses a separate config: `hardhat.config.zksync.ts`

---

## Environment

Requires archive node URLs in `.env` for fork tests (see `.env.example`):

```
ARCHIVE_NODE_bscmainnet=https://...
ARCHIVE_NODE_ethereum=https://...
```

---

## Conventions

- Solidity `^0.8.25`, OpenZeppelin upgradeable contracts (UUPS pattern)
- Tests use `@defi-wonderland/smock` for mocking and `loadFixture` for snapshot isolation
- Commit messages follow conventional commits (enforced by commitlint + husky)
- Prettier: 120 char width, double quotes (single quotes for Solidity), sorted imports
- Solhint enforces Solidity style (`.solhint.json`)
- Deploy scripts are numbered and tagged — use `--tags` to deploy selectively

---

## Venus Source Code

- **Remote**: https://github.com/VenusProtocol (use `gh` for CLI access)
- **Deployed addresses**: [venus-protocol-documentation](https://github.com/VenusProtocol/venus-protocol-documentation)
- **Related repos**: `venus-protocol`, `isolated-pools`, `vips`, `governance-contracts`
