// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { ISfrxETH } from "../interfaces/ISfrxETH.sol";
import { LiquidStakedTokenOracle } from "./common/LiquidStakedTokenOracle.sol";

/**
 * @title SFrxETHOracle
 * @author Venus
 * @notice This oracle fetches the price of sfrxETH
 */
contract SFrxETHOracle is LiquidStakedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address sfrxETH,
        address frxETH,
        address resilientOracle
    ) LiquidStakedTokenOracle(sfrxETH, frxETH, resilientOracle) {}

    /**
     * @notice Gets the frxETH for 1 sfrxETH
     * @return amount Amount of frxETH
     */
    function getUnderlyingAmount() internal view override returns (uint256) {
        return ISfrxETH(LIQUID_STAKED_TOKEN).convertToAssets(1 ether);
    }
}
