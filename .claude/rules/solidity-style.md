---
description: Solidity coding standards for all contract and interface files
globs: contracts/**/*.sol
---

# Solidity Style Rules

## Contract Layout (top -> bottom)

1. Constants (`public constant`)
2. Immutables (`public immutable` or `internal immutable`)
3. State variables (`public` for auto-getters where possible; `internal` for structs -- see Function Visibility)
4. Events
5. Errors (custom errors only -- **no `require` with strings**)
6. Modifiers
7. Constructor / `initialize`
8. `receive` / `fallback`
9. Functions (ordered by visibility, see below)

---

## Function Ordering

Within the functions section, order by visibility:

`external` -> `public` -> `internal` -> `private`

Within each visibility group:

1. ACM / access-gated (e.g. `onlyOwner`, `_checkAccessAllowed`) first
2. Permissionless second

Within each access level:

1. State-changing
2. `view`
3. `pure`

---

## Function Visibility

- **No `public` functions** -- Use `internal` helper + `external` wrapper instead.
  - **Exception:** Inherited/overridden functions from OZ or other base contracts (e.g. `getPrice()`, `initialize()`).
- State variables **should** be `public` (auto-getter). Define the corresponding getter signature in the interface.
  - **Exception:** Struct state variables -- Solidity `public` structs generate flattened return values (one value per field), not a full struct return. Use `internal` storage + explicit `external` getter that returns the struct from `memory`.
  - **Exception:** Array state variables -- Solidity `public` array auto-getters only allow index-based access. Keep the array `public` (index-based access via auto-getter), but also add an explicit `external` getter that returns the full array.

---

## Constants & Immutables

- Constants in contracts **must** be `public constant` (auto-getter).
- Constants in `library` contracts **must** be `internal constant` (Solidity restriction -- libraries cannot have `public` state).
- Contract addresses that will never change (e.g. Venus, OZ dependencies) **must** be `immutable` or `constant` -- never stored in regular state variables.
- Upgradeable contracts **may** have a `constructor` but **only** to set `immutable` variables. All other initialisation goes in `initialize()`.

---

## NatSpec

**Comment style:**

- **Multiline** NatSpec (2+ tags or long descriptions) -> use `/** ... */` block comments.
- **Single-line** NatSpec (one short tag) -> use `///` inline comments.

**Required on all `external` and `public` functions** and their interface declarations:

- `@notice` -- what the function does
- `@param` -- each parameter
- `@return` -- each return value
- `@custom:error` -- each custom error the function can revert with
- `@custom:event` -- each event the function can emit

**Required on all `internal` functions:**

- `@notice` -- what the function does (brief is fine)
- `@param` -- each parameter
- `@return` -- each return value
- `@custom:error` -- each custom error the function can revert with (integrators of the calling `external` function inherit these)

**Error attribution rule:**

- `external`/`public` functions document **only** errors thrown directly in their own body.
- Errors originating from `internal` helpers are documented on those `internal` functions instead.
- **Interface declarations** may include the full list of possible errors (direct + internal) for integrator convenience. Only include errors added by the feature contract -- no need to document errors from imported OZ or ACM base contracts.

---

## Caching

- **Cache everything** -- Never SLOAD or external-call the same value twice. Cache in local variables.
- Copy storage structs to `memory` at function entry when reading multiple fields.
- Cache `msg.sender`, `block.timestamp`, array lengths, and repeated mapping lookups.

---

## Errors & Events Placement

- **Custom errors only** -- never `require(condition, "string")`.
- For contracts **around ~500 lines or fewer**: define errors and events in the contract itself.
- For contracts **over ~600 lines**: move **all** errors and events (existing ones included) to the interface -- not just new ones. This keeps the contract focused on logic only.
- Prefix errors with the contract/interface name context (e.g. `OracleNotEnabled`, `InvalidBoundRatio`).

---

## Security

- **CEI pattern** -- Always follow Checks-Effects-Interactions order. Update all state before making any external calls.
- **SafeERC20** -- Always use `SafeERC20` for token transfers. For approvals always use `forceApprove` (never raw `.approve()`).
- **Zero address validation** -- Always validate against `address(0)` for all address parameters in constructors and `initialize()`.

---

## Events

- Setter functions **must** emit events logging both the old and new value.
- If the old value is only needed for the event (not for any logic), emit **before** writing storage to avoid an unnecessary cache variable. This is safe for ACM-guarded setters since they are access-controlled and carry no re-entrancy risk:
  ```solidity
  // preferred -- emit before write, no cache needed
  emit ValueUpdated(storedValue, newValue);
  storedValue = newValue;
  ```
- If the old value is also needed for logic, cache it first:
  ```solidity
  // cache when old value is used in logic too
  uint256 oldValue = storedValue;
  storedValue = newValue;
  emit ValueUpdated(oldValue, newValue);
  ```

---

## General Style

- **DRY** -- If the same logic is used in multiple places, extract it into a shared `internal` function and call it from all the relevant `external` functions. Never duplicate logic.
- Use named return variables only when it improves readability; otherwise use explicit `return`.
- Use `uint256` over `uint` -- always explicit bit width.
- Avoid magic numbers -- define named constants.
- One contract per file; filename matches contract name.
- Upgradeable contracts **must** declare a storage gap as the last state variable. The gap size should be `50` minus the number of storage slots already declared in that contract, so the total always sums to 50:
  ```solidity
  // e.g. contract declares 3 storage variables -> gap = 47
  uint256[47] private __gap;
  ```
