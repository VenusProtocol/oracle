// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { IWeETH } from "../interfaces/IWeETH.sol";
import { WrappedLiquidStakedTokenOracle } from "./common/WrappedLiquidStakedTokenOracle.sol";

/**
 * @title WeETHOracle
 * @author Venus
 * @notice This oracle fetches the price of weETH
 */
contract WeETHOracle is WrappedLiquidStakedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address _ETH,
        address _eETH,
        address _weETH,
        address _resilientOracle,
        bool _assumeEquivalence
    ) WrappedLiquidStakedTokenOracle(_ETH, _eETH, _weETH, _resilientOracle, _assumeEquivalence) {}

    /**
     * @notice Gets the eETH for 1 weETH
     * @return amount Amount of eETH
     */
    function getRebaseTokenAmount() internal view override returns (uint256) {
        return IWeETH(WRAPPED_TOKEN).getEETHByWeETH(1 ether);
    }
}
