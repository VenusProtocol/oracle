// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.20;

import "./BEP20Harness.sol";

contract VBEP20Harness is BEP20Harness {
    /**
     * @notice Underlying asset for this VToken
     */
    address public underlying;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals,
        address underlying_
    ) BEP20Harness(name_, symbol_, decimals) {
        underlying = underlying_;
    }
}
