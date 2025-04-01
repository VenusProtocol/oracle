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
    constructor(
        address wbeth,
        address eth,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 snapshotInterval,
        uint256 initialSnapshotExchangeRate,
        uint256 initialSnapshotTimestamp,
        address accessControlManager,
        uint256 snapshotGap
    )
        CorrelatedTokenOracle(
            wbeth,
            eth,
            resilientOracle,
            annualGrowthRate,
            snapshotInterval,
            initialSnapshotExchangeRate,
            initialSnapshotTimestamp,
            accessControlManager,
            snapshotGap
        )
    {}

    /**
     * @notice Fetches the amount of ETH for 1 wBETH
     * @return amount The amount of ETH for wBETH
     */
    function getUnderlyingAmount() public view override returns (uint256) {
        return IWBETH(CORRELATED_TOKEN).exchangeRate();
    }
}
