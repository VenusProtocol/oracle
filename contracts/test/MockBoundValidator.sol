// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../oracles/BoundValidator.sol";

contract MockBoundValidator is BoundValidator {
    function initialize() public initializer {
        __Ownable_init();
    }
}
