// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.0;

import { OracleInterface } from "../interfaces/OracleInterface.sol";

interface CorrelatedTokenOracleInterface {
    function updateSnapshot() external;
    function getPrice(address asset) external view returns (uint256);
}

contract MockCallPrice {
    function getMultiPrice(CorrelatedTokenOracleInterface oracle, address asset) public returns (uint256, uint256) {
        oracle.updateSnapshot();
        return (oracle.getPrice(asset), oracle.getPrice(asset));
    }
}
