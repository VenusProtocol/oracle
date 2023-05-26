// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "../interfaces/OracleInterface.sol";

contract MockSimpleOracle is OracleInterface {
    mapping(address => uint256) public prices;

    constructor() {
        //
    }

    function getUnderlyingPrice(address vToken) external view returns (uint256) {
        return prices[vToken];
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

    function setValidateResult(address vToken, bool pass) public {
        validateResults[vToken] = pass;
    }
}
