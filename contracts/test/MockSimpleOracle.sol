// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.20;

import "../interfaces/OracleInterface.sol";

contract MockSimpleOracle is OracleInterface {
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

contract MockBoundValidator is BoundValidatorInterface {
    mapping(address => bool) public validateResults;
    bool public twapUpdated;

    constructor() {
        //
    }

    function validatePriceWithAnchorPrice(
        address vToken,
        uint256 reporterPrice,
        uint256 anchorPrice
    ) external view returns (bool) {
        return validateResults[vToken];
    }

    function validateAssetPriceWithAnchorPrice(
        address asset,
        uint256 reporterPrice,
        uint256 anchorPrice
    ) external view returns (bool) {
        return validateResults[asset];
    }

    function setValidateResult(address token, bool pass) public {
        validateResults[token] = pass;
    }
}
