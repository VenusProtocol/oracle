// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { ISfrxETH } from "../interfaces/ISfrxETH.sol";
import { WrappedLiquidStakedTokenOracle } from "./common/WrappedLiquidStakedTokenOracle.sol";

/**
 * @title SFrxETHOracle
 * @author Venus
 * @notice This oracle fetches the price of sfrxETH
 */
contract SFrxETHOracle is WrappedLiquidStakedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address _eth,
        address _frxETH,
        address _sfrxETH,
        address _resilientOracle,
        bool _assumeEquivalence
    ) WrappedLiquidStakedTokenOracle(_eth, _frxETH, _sfrxETH, _resilientOracle, _assumeEquivalence) {}

    /**
     * @notice Gets the frxETH for 1 sfrxETH
     * @return amount Amount of frxETH
     */
    function getRebaseTokenAmount() internal view override returns (uint256) {
        return ISfrxETH(WRAPPED_TOKEN).convertToAssets(1 ether);
    }
}
