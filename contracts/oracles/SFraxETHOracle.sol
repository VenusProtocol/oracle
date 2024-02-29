// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { ISFrax } from "../interfaces/ISFrax.sol";
import { ISfraxETH } from "../interfaces/ISfraxETH.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";
import { WrappedLiquidStakedTokenOracle } from "./common/WrappedLiquidStakedTokenOracle.sol";

/**
 * @title SFraxETHOracle
 * @author Venus
 * @notice This oracle fetches the price of sfrxETH
 */
contract SFraxETHOracle is WrappedLiquidStakedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address _eth,
        address _fraxETH,
        address _sfraxETH,
        address _resilientOracle,
        bool _assumeEquivalence
    ) WrappedLiquidStakedTokenOracle(_eth, _fraxETH, _sfraxETH, _resilientOracle, _assumeEquivalence) {}

    /**
     * @notice Gets the fraxETH for 1 sfrxETH
     * @return amount Amount of fraxETH
     */
    function getRebaseTokenAmount() internal view override returns (uint256) {
        return ISfraxETH(WRAPPED_TOKEN).convertToAssets(1 ether);
    }
}
