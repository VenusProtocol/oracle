// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../../interfaces/VBep20Interface.sol";

contract MockBinanceOracle is OwnableUpgradeable {
    mapping(address => uint256) public assetPrices;

    constructor() {}

    function setPrice(address asset, uint256 price) external {
        assetPrices[asset] = price;
    }

    function initialize() public initializer {}

    function getUnderlyingPrice(address vToken) public view returns (uint256) {
        address token = VBep20Interface(vToken).underlying();
        return assetPrices[token];
    }
}
