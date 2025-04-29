// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";
import { IEtherFiLiquidityPool } from "../interfaces/IEtherFiLiquidityPool.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

/**
 * @title WeETHOracle
 * @author Venus
 * @notice This oracle fetches the price of weETH
 */
contract WeETHOracle is CorrelatedTokenOracle {
    /// @notice Address of Liqiudity pool
    IEtherFiLiquidityPool public immutable LIQUIDITY_POOL;

    /// @notice Constructor for the implementation contract.
    constructor(
        address liquidityPool,
        address weETH,
        address eETH,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 _snapshotInterval,
        uint256 initialSnapshotExchangeRate,
        uint256 initialSnapshotTimestamp,
        address accessControlManager,
        uint256 _snapshotGap
    )
        CorrelatedTokenOracle(
            weETH,
            eETH,
            resilientOracle,
            annualGrowthRate,
            _snapshotInterval,
            initialSnapshotExchangeRate,
            initialSnapshotTimestamp,
            accessControlManager,
            _snapshotGap
        )
    {
        ensureNonzeroAddress(liquidityPool);
        LIQUIDITY_POOL = IEtherFiLiquidityPool(liquidityPool);
    }

    /**
     * @notice Gets the eETH for 1 weETH
     * @return amount Amount of eETH
     */
    function getUnderlyingAmount() public view override returns (uint256) {
        return LIQUIDITY_POOL.amountForShare(EXP_SCALE);
    }
}
