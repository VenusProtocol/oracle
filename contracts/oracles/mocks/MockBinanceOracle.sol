// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../../interfaces/VBep20Interface.sol";

contract MockBinanceOracle is OwnableUpgradeable {
    mapping(address => uint256) public assetPrices;

    constructor() {}

    function initialize() public initializer {
        __Ownable_init();
    }

    function setPrice(address asset, uint256 price) external {
        assetPrices[asset] = price;
    }

    function getUnderlyingPrice(address vToken) public view returns (uint256) {
        return assetPrices[vToken];
    }
}
