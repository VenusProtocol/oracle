// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

interface ISfrxEthFraxOracle {
    function getPrices() external view returns (bool _isbadData, uint256 _priceLow, uint256 _priceHigh);
}
