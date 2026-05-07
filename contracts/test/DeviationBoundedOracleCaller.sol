// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IDeviationBoundedOracle } from "../interfaces/IDeviationBoundedOracle.sol";

/// @notice Test helper that batches DeviationBoundedOracle calls in a single transaction
///         so transient storage (tstore/tload) cache can be tested.
contract DeviationBoundedOracleCaller {
    IDeviationBoundedOracle public immutable oracle;

    constructor(address _oracle) {
        oracle = IDeviationBoundedOracle(_oracle);
    }

    function updateAndGetCollateralPrice(address vToken) external returns (uint256) {
        oracle.updateProtectionState(vToken);
        return oracle.getBoundedCollateralPriceView(vToken);
    }

    function updateAndGetDebtPrice(address vToken) external returns (uint256) {
        oracle.updateProtectionState(vToken);
        return oracle.getBoundedDebtPriceView(vToken);
    }

    function updateAndGetBothPrices(address vToken) external returns (uint256 collateral, uint256 debt) {
        oracle.updateProtectionState(vToken);
        collateral = oracle.getBoundedCollateralPriceView(vToken);
        debt = oracle.getBoundedDebtPriceView(vToken);
    }

    function updateThenNonViewCollateral(address vToken) external returns (uint256) {
        oracle.updateProtectionState(vToken);
        return oracle.getBoundedCollateralPrice(vToken);
    }

    function twoConsecutiveNonViewCollateral(address vToken) external returns (uint256 first, uint256 second) {
        first = oracle.getBoundedCollateralPrice(vToken);
        second = oracle.getBoundedCollateralPrice(vToken);
    }

    /// @notice Non-view wrapper so smock records oracle calls made by the view functions.
    function getViewPricesWithoutUpdateNonView(address vToken) external returns (uint256 collateral, uint256 debt) {
        collateral = oracle.getBoundedCollateralPriceView(vToken);
        debt = oracle.getBoundedDebtPriceView(vToken);
    }

    /// @notice Calls updateProtectionState on vTokenA, then getBoundedCollateralPriceView on vTokenB.
    function updateAViewB(address vTokenA, address vTokenB) external returns (uint256) {
        oracle.updateProtectionState(vTokenA);
        return oracle.getBoundedCollateralPriceView(vTokenB);
    }

    function getViewPricesWithoutUpdate(address vToken) external view returns (uint256 collateral, uint256 debt) {
        collateral = oracle.getBoundedCollateralPriceView(vToken);
        debt = oracle.getBoundedDebtPriceView(vToken);
    }
}
