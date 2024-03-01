// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { IWeETH } from "../interfaces/IWeETH.sol";
import { LiquidStakedTokenOracle } from "./common/LiquidStakedTokenOracle.sol";

/**
 * @title WeETHOracle
 * @author Venus
 * @notice This oracle fetches the price of weETH
 */
contract WeETHOracle is LiquidStakedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address weETH,
        address eETH,
        address resilientOracle
    ) LiquidStakedTokenOracle(weETH, eETH, resilientOracle) {}

    /**
     * @notice Gets the eETH for 1 weETH
     * @return amount Amount of eETH
     */
    function getUnderlyingAmount() internal view override returns (uint256) {
        return IWeETH(LIQUID_STAKED_TOKEN).getEETHByWeETH(1 ether);
    }
}
