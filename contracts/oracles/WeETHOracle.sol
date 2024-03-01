// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { IWeETH } from "../interfaces/IWeETH.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";

/**
 * @title WeETHOracle
 * @author Venus
 * @notice This oracle fetches the price of weETH
 */
contract WeETHOracle is CorrelatedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address weETH,
        address eETH,
        address resilientOracle
    ) CorrelatedTokenOracle(weETH, eETH, resilientOracle) {}

    /**
     * @notice Gets the eETH for 1 weETH
     * @return amount Amount of eETH
     */
    function getUnderlyingAmount() internal view override returns (uint256) {
        return IWeETH(CORRELATED_TOKEN).getEETHByWeETH(1 ether);
    }
}
