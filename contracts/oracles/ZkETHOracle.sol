// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IZkETH } from "../interfaces/IZkETH.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";

/**
 * @title ZkETHOracle
 * @author Venus
 * @notice This oracle fetches the price of zkETH
 */
contract ZkETHOracle is CorrelatedTokenOracle {
    /// @notice Constructor for the implementation contract.
    constructor(
        address zkETH,
        address rzkETH,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 _snapshotInterval,
        uint256 initialSnapshotExchangeRate,
        uint256 initialSnapshotTimestamp,
        address accessControlManager,
        uint256 _snapshotGap
    )
        CorrelatedTokenOracle(
            zkETH,
            rzkETH,
            resilientOracle,
            annualGrowthRate,
            _snapshotInterval,
            initialSnapshotExchangeRate,
            initialSnapshotTimestamp,
            accessControlManager,
            _snapshotGap
        )
    {}

    /**
     * @notice Gets the amount of rzkETH for 1 zkETH
     * @return amount Amount of rzkETH
     */
    function getUnderlyingAmount() public view override returns (uint256) {
        return IZkETH(CORRELATED_TOKEN).LSTPerToken();
    }
}
