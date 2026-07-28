// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { BEP20Harness } from "./BEP20Harness.sol";

/**
 * @title MockTokenizedStock
 * @notice Stand-in for an ERC-8056 tokenized stock: an ERC-20 that also reports a UI multiplier.
 *         The real token derives `uiMultiplier` from a scheduled value that activates on its own at a
 *         timestamp; here it is set directly so tests can drive it to any value, including zero.
 */
contract MockTokenizedStock is BEP20Harness {
    uint256 public uiMultiplier;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 uiMultiplier_
    ) BEP20Harness(name_, symbol_, decimals_) {
        uiMultiplier = uiMultiplier_;
    }

    function setUIMultiplier(uint256 uiMultiplier_) external {
        uiMultiplier = uiMultiplier_;
    }
}
