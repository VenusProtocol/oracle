// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IStETH } from "../interfaces/IStETH.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

/**
 * @title WstETHOracleV2
 * @author Venus
 * @notice This oracle fetches the price of wstETH
 */
contract WstETHOracleV2 is CorrelatedTokenOracle {
    /// @notice Address of stETH
    IStETH public immutable STETH;

    /// @notice Constructor for the implementation contract.
    /// @dev The underlyingToken must be correlated so that 1 underlyingToken is equal to 1 stETH, because
    /// getUnderlyingAmount() implicitly assumes that
    constructor(
        address stETH,
        address wstETH,
        address underlyingToken,
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
            underlyingToken,
            resilientOracle,
            annualGrowthRate,
            _snapshotInterval,
            initialSnapshotMaxExchangeRate,
            initialSnapshotTimestamp,
            accessControlManager,
            _snapshotGap
        )
    {
        ensureNonzeroAddress(stETH);
        STETH = IStETH(stETH);
    }

    /**
     * @notice Gets the amount of underlyingToken for 1 wstETH, assuming that 1 underlyingToken is equivalent to 1 stETH
     * @return amount Amount of underlyingToken
     */
    function getUnderlyingAmount() public view override returns (uint256) {
        return STETH.getPooledEthByShares(EXP_SCALE);
    }
}
