// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IStETH } from "../interfaces/IStETH.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title WstETHOracleV2
 * @author Venus
 * @notice This oracle fetches the price of wstETH
 */
contract WstETHOracleV2 is CorrelatedTokenOracle {
    /// @notice Constructor for the implementation contract.
    constructor(
        address wstETH,
        address stETH,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 _snapshotInterval,
        uint256 initialSnapshotMaxExchangeRate,
        uint256 initialSnapshotTimestamp,
        address accessControlManager,
        uint256 _snapshotGap
    )
        CorrelatedTokenOracle(
            wstETH,
            stETH,
            resilientOracle,
            annualGrowthRate,
            _snapshotInterval,
            initialSnapshotMaxExchangeRate,
            initialSnapshotTimestamp,
            accessControlManager,
            _snapshotGap
        )
    {}

    /**
     * @notice Gets the stETH for 1 wstETH
     * @return amount Amount of stETH
     */
    function getUnderlyingAmount() public view override returns (uint256) {
        return IStETH(UNDERLYING_TOKEN).getPooledEthByShares(EXP_SCALE);
    }
}
