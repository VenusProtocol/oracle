// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { IStETH } from "../interfaces/IStETH.sol";
import { LiquidStakedTokenOracle } from "./common/LiquidStakedTokenOracle.sol";

/**
 * @title WstETHOracle
 * @author Venus
 * @notice This oracle fetches the price of wstETH
 */
contract WstETHOracle is LiquidStakedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address wstETH,
        address stETH,
        address resilientOracle
    ) LiquidStakedTokenOracle(wstETH, stETH, resilientOracle) {}

    /**
     * @notice Gets the stETH for 1 wstETH
     * @return amount Amount of stETH
     */
    function getUnderlyingAmount() internal view override returns (uint256) {
        return IStETH(UNDERLYING_TOKEN).getPooledEthByShares(1 ether);
    }
}
