# Foundry

Foundry runs alongside Hardhat here, it does not replace it. `contracts/` is shared; the TypeScript
suite in `test/` is untouched.

`yarn test`, `yarn compile` and `yarn clean` run Hardhat first and then Foundry. `yarn build` is
Hardhat-only: it produces the published package. To work on the Foundry suite alone:

```
forge test                      256 fuzz runs
FOUNDRY_PROFILE=ci forge test   the 2000 runs CI uses
```

## What belongs where

Hardhat keeps the TypeScript tests, deployments (`deploy/`, `deployments/`, which the other Venus
repos consume), the zkSync build, docgen and coverage. Write a Foundry test only when Hardhat cannot
express it: in-EVM fuzzing, stateful invariants, cheatcode-driven fork tests. A plain unit test
belongs in `test/` next to its siblings, and existing tests are not being ported.

Tests are named after the contract under test. Once a contract needs more than one file, move them
into a directory named after it.

## Traps

- The oracles disable initializers in their constructors. Deploy them behind an `ERC1967Proxy` with
  the `initialize` call as its data, the way `BoundValidator.t.sol` does.
- `vm.prank` applies to **the next call made**, not the next line. In
  `oracle.getPrice(vToken.underlying())` the prank is spent on `underlying()`. Read values into
  locals first.
- A failing fuzz input is persisted under `cache-foundry/` and replayed first. After changing an
  assertion, delete that directory or the old counterexample keeps failing.
- `out = 'out'` in `foundry.toml` is not redundant. With Hardhat's `artifacts/` present, Foundry
  writes its artifacts there instead.

## Dependencies

Solidity dependencies come from npm: Foundry derives remappings from `node_modules`, so run `yarn`
before `forge`. `forge-std` is the exception, a git submodule at `lib/forge-std`, because its npm
package is an abandoned fork. Clone with `--recurse-submodules`, or run
`git submodule update --init --recursive`.

`remappings.txt` holds only the `forge-std` line, for Solidity language servers, which do not read
`foundry.toml`. The `node_modules` remappings are still derived on top of it.

## Formatting

Prettier formats all Solidity, `test/foundry` included. `forge fmt` is not configured, so the two
never fight over the same files.
