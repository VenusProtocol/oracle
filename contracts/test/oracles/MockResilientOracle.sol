// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import "../../interfaces/OracleInterface.sol";

contract MockOracle is OracleInterface {
    mapping(address => uint256) public prices;

    function getPrice(address asset) external view returns (uint256) {
        return prices[asset];
    }

    function setPrice(address vToken, uint256 price) public {
        prices[vToken] = price;
    }
}
