// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../interfaces/OracleInterface.sol";

contract MockSimpleOracle is OracleInterface {
    mapping(address => uint256) public prices;

    constructor() {
        //
    }

    function setPrice(address vToken, uint256 price) public {
        prices[vToken] = price;
    } 

    function getUnderlyingPrice(address vToken) external view returns (uint256) {
        return prices[vToken];
    }

    function fetchUnderlyingPrice(address vToken) external returns (uint256) {
        return prices[vToken];
    }
}

contract MockPivotOracle is MockSimpleOracle, PivotOracleInterface {
    mapping(address => bool) public validateResults;

    constructor() {
        //
    }

    function setValidateResult(address vToken, bool pass) public {
        validateResults[vToken] = pass;
    }

    function validatePrice(address vToken, uint256 price) external view returns (bool) {
        return validateResults[vToken];
    }
}

