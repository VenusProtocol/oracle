// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import "../../interfaces/OracleInterface.sol";

contract MockResilientOracle is OracleInterface {
    mapping(address => uint256) public prices;

    constructor() {
        //
    }

    function getUnderlyingPrice(address vToken) external view returns (uint256) {
        return prices[vToken];
    }

    function getPrice(address asset) external view returns (uint256) {
        return prices[asset];
    }

    function setPrice(address vToken, uint256 price) public {
        prices[vToken] = price;
    }
}
