// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

interface OracleInterface {
    function getUnderlyingPrice(address vToken) external view returns (uint256);
}

interface ResilientOracleInterface is OracleInterface {
    function updatePrice(address vToken) external;
}

interface TwapInterface is OracleInterface {
    function updateTwap(address vToken) external returns (uint256);
}

interface BoundValidatorInterface {
    function validatePriceWithAnchorPrice(
        address vToken,
        uint256 reporterPrice,
        uint256 anchorPrice
    ) external view returns (bool);
}
