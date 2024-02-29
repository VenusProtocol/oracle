// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { ISFrax } from "../interfaces/ISFrax.sol";
import { ISfraxETH } from "../interfaces/ISfraxETH.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { LiquidStakedTokenOracle } from "./common/LiquidStakedTokenOracle.sol";

/**
 * @title SFraxOracle
 * @author Venus
 * @notice This oracle fetches the price of sFrax
 */
contract SFraxOracle is LiquidStakedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address _frax,
        address _sFrax,
        address _resilientOracle
    ) LiquidStakedTokenOracle(_sFrax, _frax, _resilientOracle) {}

    /**
     * @notice Fetches the amount of FRAX for 1 sFrax
     * @return amount The amount of FRAX for sFrax
     */
    function getUnderlyingAmount() internal view override returns (uint256) {
        return ISFrax(LIQUID_STAKED_TOKEN).convertToAssets(1 ether);
    }
}
