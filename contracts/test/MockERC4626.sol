// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IERC4626 } from "../interfaces/IERC4626.sol";

contract MockERC4626 is IERC4626 {
    string public name;
    string public symbol;
    uint8 internal _decimals;
    uint256 internal _convertToAssets;

    constructor(string memory _name, string memory _symbol, uint8 decimals_) {
        name = _name;
        symbol = _symbol;
        _decimals = decimals_;
        _convertToAssets = 10 ** decimals_;
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function convertToAssets(uint256) external view override returns (uint256) {
        return _convertToAssets;
    }

    function setConvertToAssets(uint256 rate) external {
        _convertToAssets = rate;
    }
}
