// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ISfrxEthFraxOracle } from "../interfaces/ISfrxEthFraxOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockSfrxEthFraxOracle is Ownable, ISfrxEthFraxOracle {
    bool public isDadData;
    uint256 public priceLow;
    uint256 public priceHigh;

    constructor() Ownable() {}

    function setPrices(
        bool _isbadData,
        uint256 _priceLow,
        uint256 _priceHigh
    ) external onlyOwner {
        isDadData = _isbadData;
        priceLow = _priceLow;
        priceHigh = _priceHigh;
    }

    function getPrices() external view override returns (bool _isbadData, uint256 _priceLow, uint256 _priceHigh) {
        return (isDadData, priceLow, priceHigh);
    }
}
