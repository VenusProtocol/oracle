---
description: Rules for when and how to write or update tests
globs: test/**/*.ts
---

# Testing Rules

## When to Write Tests

- During the **design and initial build of a new feature or contract**, tests are written only on explicit request -- do not write or edit tests while the design is still settling.
- For **small changes, normal changes and bug fixes**, always update the affected tests and add tests for the new behaviour in the same change -- do not ask first. _(Also in CLAUDE.md so this rule is always in context.)_
- Write tests against **intended behaviour**, not against what the code currently does. If a test fails, ask the user whether the behaviour is correct or the code has a bug -- never silently adjust a test to make it pass.

---

## Assertions

- **Always exact** -- `expect(actual).to.equal(expected)`. Weak assertions like `expect(balance).to.be.gt(0)` when the expected value is known are not acceptable.
- Use `gt` / `lt` only when the result is genuinely variable (e.g. a loss scenario). Even then, compute the expected value and assert it exactly or near-exactly.
- `closeTo` / approximate assertions only when rounding genuinely prevents an exact comparison -- never as a shortcut.

---

## Events

- Always assert the primary function-specific event -- not just underlying `Transfer` / `Approval`.
- Use `.to.emit(contract, "EventName").withArgs(...)` with all arguments verified.

---

## Mocking

- Prefer the real code path. Only mock external dependencies (oracles, external protocols) when there is no alternative.
- Use `@defi-wonderland/smock` for mocking external contracts. Prefer `smock.mock` — use `smock.fake` only when `smock.mock` cannot be used (e.g. the contract has no deployable artifact).
- Never mock internal contract behaviour -- test it directly.
