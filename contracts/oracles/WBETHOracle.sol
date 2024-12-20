// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IWBETH } from "../interfaces/IWBETH.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";

/**
 * @title WBETHOracle
 * @author Venus
 * @notice This oracle fetches the price of wBETH asset
 */
contract WBETHOracle is CorrelatedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address wbeth,
        address eth,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 storedSnapshotPrice
    ) CorrelatedTokenOracle(wbeth, eth, resilientOracle, annualGrowthRate, storedSnapshotPrice) {}

    /**
     * @notice Fetches the amount of ETH for 1 wBETH
     * @return amount The amount of ETH for wBETH
     */
    function _getUnderlyingAmount() internal view override returns (uint256) {
        return IWBETH(CORRELATED_TOKEN).exchangeRate();
    }
}
