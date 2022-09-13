// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;


interface OracleInterface {
    function getUnderlyingPrice(address vToken) external view returns (uint256);
}

interface PivotValidatorInterface {
    function validatePrice(address vToken, uint256 price) external view returns (bool);
}

interface PivotOracleInterface is OracleInterface, PivotValidatorInterface {
}
