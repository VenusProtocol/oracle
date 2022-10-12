// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./BoundValidator.sol";
import "./TwapOracle.sol";
import "../interfaces/BEP20Interface.sol";
import "../interfaces/VBep20Interface.sol";

contract PivotTwapOracle is TwapOracle, BoundValidator, PivotOracleInterface {
    /**
     * @notice Test reported vToken underlying price against stored TWAP
     * @param vToken vToken address
     * @param reporterPrice the price to be tested
     */
    function validatePrice(address vToken, uint256 reporterPrice) external view override returns (bool) {
        address asset = VBep20Interface(vToken).underlying();
        return validatePriceWithAnchorPrice(vToken, reporterPrice, prices[asset]);
    }
}
