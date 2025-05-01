// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.0;

import { IAsBNBMinter } from "../interfaces/IAsBNBMinter.sol";

contract MockAsBNBMinter is IAsBNBMinter {
    function convertToTokens(uint256 _amount) external pure override returns (uint256) {
        return _amount;
    }
}
