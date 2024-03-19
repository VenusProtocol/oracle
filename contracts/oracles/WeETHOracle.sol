// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

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
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IEtherFiLiquidityPool public immutable LIQUIDITY_POOL;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address liquidityPool,
        address weETH,
        address eETH,
        address resilientOracle
    ) CorrelatedTokenOracle(weETH, eETH, resilientOracle) {
        ensureNonzeroAddress(liquidityPool);
        LIQUIDITY_POOL = IEtherFiLiquidityPool(liquidityPool);
    }

    /**
     * @notice Gets the eETH for 1 weETH
     * @return amount Amount of eETH
     */
    function getUnderlyingAmount() internal view override returns (uint256) {
        return LIQUIDITY_POOL.amountForShare(EXP_SCALE);
    }
}
