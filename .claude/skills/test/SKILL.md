---
name: test
description: Write Hardhat/TypeScript unit and fork tests for an oracle contract — reads the contract, studies existing test patterns, generates a comprehensive test file
argument-hint: <ContractName or path>
---

# Test Skill

Write Hardhat tests for: **$ARGUMENTS**

Follow all rules in `.claude/rules/testing.md` throughout.

---

## Workflow

Read the contract, its interface, and existing tests. Use subagents when needed. Draft a plan covering what to test and which paths to cover, present it to the user, and only proceed once confirmed.

The guidance below applies to whichever test type the user requests.

---

## Unit Tests

One test file per contract in `test/`. The structure below is a reference — substitute actual contract names, addresses, and constructor args for the contract under test.

```typescript
import { smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumberish } from "ethers";
import { ethers, upgrades } from "hardhat";

import { AccessControlManager, ChainlinkOracle, MockV3Aggregator, ResilientOracle } from "../typechain-types";

// Helper: wire a fixed price for `asset` through a real Chainlink feed → ChainlinkOracle → ResilientOracle.
// Returns the MockV3Aggregator so callers can update the price later with `feed.updateAnswer(newPrice)`.
async function setAssetPrice(
  resilientOracle: ResilientOracle,
  chainlinkOracle: ChainlinkOracle,
  asset: string,
  price: BigNumberish,
  maxStalePeriod = 60 * 60,
): Promise<MockV3Aggregator> {
  const feed = await (await ethers.getContractFactory("MockV3Aggregator")).deploy(8, price);
  await chainlinkOracle.setTokenConfig({ asset, feed: feed.address, maxStalePeriod });
  await resilientOracle.setTokenConfig({
    asset,
    oracles: [chainlinkOracle.address, ethers.constants.AddressZero, ethers.constants.AddressZero],
    enableFlagsForOracles: [true, false, false],
    cachingEnabled: false,
  });
  return feed;
}

describe("<ContractName>", async () => {
  const fixture = async () => {
    const [deployer, user] = await ethers.getSigners();

    // ACM is an external dependency — mock it and allow all calls
    const acm = await smock.mock<AccessControlManager>("AccessControlManager");
    acm.isAllowedToCall.returns(true);

    // Real ChainlinkOracle
    const ChainlinkOracleFactory = await ethers.getContractFactory("ChainlinkOracle");
    const chainlinkOracle = <ChainlinkOracle>await upgrades.deployProxy(ChainlinkOracleFactory, [acm.address]);

    // Real ResilientOracle — pass nativeMarket, vai, boundValidator as needed
    const ResilientOracleFactory = await ethers.getContractFactory("ResilientOracle");
    const resilientOracle = <ResilientOracle>await upgrades.deployProxy(ResilientOracleFactory, [acm.address], {
      constructorArgs: [nativeMarket, vai, boundValidator],
    });

    // Wire a price: feed returned for later updates via feed.updateAnswer(newPrice)
    const feed = await setAssetPrice(resilientOracle, chainlinkOracle, asset.address, /* 8-decimal price */ BigNumber.from("100000000"));

    // deploy contract under test
    const Factory = await ethers.getContractFactory("<ContractName>");
    const contract = await Factory.deploy(resilientOracle.address, ...);

    return { contract, resilientOracle, chainlinkOracle, feed, acm, deployer, user };
  };

  let contract: <ContractName>;
  let feed: MockV3Aggregator;

  beforeEach(async () => {
    ({ contract, feed, resilientOracle, chainlinkOracle, acm, deployer, user } = await loadFixture(fixture));
  });

  // ────────────────────────────────────────────────────────────────────────
  // Section Name
  // ────────────────────────────────────────────────────────────────────────

  describe("getPrice", async () => {
    it("should return correct price for valid asset", async () => {
      // ...
    });
  });
});
```

**Ordering:** Full path test first -- one comprehensive happy path test asserting every important value (return values, state, events). This is the canonical reference for how the feature behaves and makes manual review easy. Focused tests come after -- isolate a specific behaviour or edge case, with a comment explaining what is skipped and why:

```typescript
// Full getPrice path covered in "should return correct price for valid asset".
// This test focuses on staleness check only -- price calculation assertions skipped.
```

**Patterns:**

- **Fixture**: Use `loadFixture(fixture)` in `beforeEach` for snapshot isolation.
- **Mocks**: Use `smock.mock<IInterface>("IInterface")` for external dependencies (fall back to `smock.fake` only when no artifact exists); configure return values with `mock.functionName.returns(value)`.
- **Signers**: Use `contract.connect(signer).method()` to call as a specific address.
- **Reverts**: `await expect(tx).to.be.revertedWithCustomError(contract, "ErrorName")` -- never string-based.
- **Events**: `await expect(tx).to.emit(contract, "EventName").withArgs(arg1, arg2)`.
- **Time**: `await time.increase(seconds)` or `await time.setNextBlockTimestamp(ts)` from `@nomicfoundation/hardhat-network-helpers`.
- **Prices**: Always use real `ResilientOracle` + real `ChainlinkOracle` + `MockV3Aggregator`. Use the `setAssetPrice` helper (defined at the top of the file) to wire a price for an asset. To change a price mid-test: `await feed.updateAnswer(newPrice)` (8-decimal format).

**Don't:**

- Test OZ/base contract internals (Ownable, AccessControl, Initializable).
- Create new mocks if existing ones in `test/` suffice.
- Duplicate revert paths already tested in another file.
- Add fuzz tests unless explicitly asked.

---

## Fork Tests

Fork tests live in `test/fork/`. Run with `FORK=true FORKED_NETWORK=<network>`.

- Deploy the new contract inside the fork test itself — do not rely on a live deployment.
- Use real mainnet addresses for already-deployed contracts (oracles, resilientOracle, ACM) so live state is part of the test.
- Mirror the unit test flow but validate calculations against real on-chain data.
- Import shared helpers from `test/fork/utils.ts` (addresses, signers, impersonation helpers).

```typescript
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

// Use live mainnet addresses — no mocks
const RESILIENT_ORACLE = "0x<mainnet-address>";
const ACM = "0x<mainnet-address>";

describe("<ContractName> fork tests", () => {
  const fixture = async () => {
    const [deployer] = await ethers.getSigners();

    const resilientOracle = await ethers.getContractAt("ResilientOracle", RESILIENT_ORACLE);

    const Factory = await ethers.getContractFactory("<ContractName>");
    const contract = await Factory.deploy(resilientOracle.address, ...);

    return { contract, resilientOracle, deployer };
  };

  let contract: <ContractName>;

  beforeEach(async () => {
    ({ contract, resilientOracle, deployer } = await loadFixture(fixture));
  });

  it("returns correct price for <asset> on mainnet", async () => {
    const price = await contract.getPrice(ASSET_ADDRESS);
    // Assert against known on-chain value or a reasonable range
    expect(price).to.be.gt(0);
  });
});
```

---

## Verify

Run `npx hardhat test test/<TestFileName>.ts` and fix any failures before reporting to the user.

---

## Post-deployment Changes

This applies when a contract is already deployed in production and a subsequent PR introduces new functionality or changes — not the initial implementation PR.

- Update the existing unit test file for the affected contract.
- Create a new focused test file covering all scenarios introduced or affected by the change.
