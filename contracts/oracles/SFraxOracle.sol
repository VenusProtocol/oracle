// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { ISFrax } from "../interfaces/ISFrax.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title SFraxOracle
 * @author Venus
 * @notice This oracle fetches the price of sFrax
 */
contract SFraxOracle is CorrelatedTokenOracle {
    /// @notice Constructor for the implementation contract.
    constructor(
        address sFrax,
        address frax,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 _snapshotInterval,
        uint256 initialSnapshotExchangeRate,
        uint256 initialSnapshotTimestamp,
        address accessControlManager,
        uint256 _snapshotGap
    )
        CorrelatedTokenOracle(
            sFrax,
            frax,
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
     * @notice Fetches the amount of FRAX for 1 sFrax
     * @return amount The amount of FRAX for sFrax
     */
    function getUnderlyingAmount() public view override returns (uint256) {
        return ISFrax(CORRELATED_TOKEN).convertToAssets(EXP_SCALE);
    }
}
