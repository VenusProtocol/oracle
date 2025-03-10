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
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address zkETH,
        address rzkETH,
        address resilientOracle
    ) CorrelatedTokenOracle(zkETH, rzkETH, resilientOracle) {}

    /**
     * @notice Gets the amount of rzkETH for 1 zkETH
     * @return amount Amount of rzkETH
     */
    function _getUnderlyingAmount() internal view override returns (uint256) {
        return IZkETH(CORRELATED_TOKEN).LSTPerToken();
    }
}
