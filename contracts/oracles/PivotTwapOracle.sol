// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./BoundValidator.sol";
import "./TwapOracle.sol";

contract PivotTwapOracle is TwapOracle, BoundValidator, PivotOracleInterface {
    /**
     * @notice Test reported vToken underlying price against stored TWAP
     * @param vToken vToken address
     * @param reporterPrice the price to be tested
     */
    function validatePrice(address vToken, uint256 reporterPrice) external view override returns (bool) {
        return validatePriceWithAnchorPrice(vToken, reporterPrice, prices[vToken]);
    }
}
