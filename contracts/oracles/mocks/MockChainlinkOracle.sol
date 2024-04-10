// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { OracleInterface } from "../../interfaces/OracleInterface.sol";

contract MockChainlinkOracle is OwnableUpgradeable, OracleInterface {
    mapping(address => uint256) public assetPrices;

    //set price in 6 decimal precision
    constructor() {}

    function initialize() public initializer {
        __Ownable_init();
    }

    function setPrice(address asset, uint256 price) external {
        assetPrices[asset] = price;
    }

    //https://compound.finance/docs/prices
    function getPrice(address token) public view returns (uint256) {
        return assetPrices[token];
    }
}
