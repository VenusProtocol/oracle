// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

interface OracleInterface {
    function getPrice(address asset) external view returns (uint256);
}

interface ResilientOracleInterface is OracleInterface {
    function updatePrice(address vToken) external;

    function updateAssetPrice(address asset) external;

    function getUnderlyingPrice(address vToken) external view returns (uint256);
}

interface TwapInterface is OracleInterface {
    function updateTwap(address asset) external returns (uint256);
}

interface BoundValidatorInterface {
    function validatePriceWithAnchorPrice(
        address asset,
        uint256 reporterPrice,
        uint256 anchorPrice
    ) external view returns (bool);
}
