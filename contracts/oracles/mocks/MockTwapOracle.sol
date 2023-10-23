// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { OracleInterface } from "../../interfaces/OracleInterface.sol";

contract MockTwapOracle is OwnableUpgradeable {
    mapping(address => uint256) public assetPrices;

    /// @notice vBNB address
    address public vBNB;

    //set price in 6 decimal precision
    constructor() {}

    function initialize(address vBNB_) public initializer {
        __Ownable_init();
        if (vBNB_ == address(0)) revert("vBNB can't be zero address");
        vBNB = vBNB_;
    }

    function setPrice(address asset, uint256 price) external {
        assetPrices[asset] = price;
    }

    //https://compound.finance/docs/prices
    function getPrice(address token) public view returns (uint256) {
        return assetPrices[token];
    }
}
