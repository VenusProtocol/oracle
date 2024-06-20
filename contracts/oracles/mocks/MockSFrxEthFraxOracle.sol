// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import "../../interfaces/ISfrxEthFraxOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockSfrxEthFraxOracle is ISfrxEthFraxOracle, Ownable {
    bool public isBadData;
    uint256 public priceLow;
    uint256 public priceHigh;

    constructor() Ownable() {}

    function setPrices(bool _isBadData, uint256 _priceLow, uint256 _priceHigh) external onlyOwner {
        isBadData = _isBadData;
        priceLow = _priceLow;
        priceHigh = _priceHigh;
    }

    function getPrices() external view override returns (bool, uint256, uint256) {
        return (isBadData, priceLow, priceHigh);
    }
}
