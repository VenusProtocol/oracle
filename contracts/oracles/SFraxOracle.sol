// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { ISFrax } from "../interfaces/ISFrax.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";

/**
 * @title SFraxOracle
 * @author Venus
 * @notice This oracle fetches the price of sFrax
 */
contract SFraxOracle is CorrelatedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address _sFrax,
        address _frax,
        address _resilientOracle
    ) CorrelatedTokenOracle(_sFrax, _frax, _resilientOracle) {}

    /**
     * @notice Fetches the amount of FRAX for 1 sFrax
     * @return amount The amount of FRAX for sFrax
     */
    function getUnderlyingAmount() internal view override returns (uint256) {
        return ISFrax(CORRELATED_TOKEN).convertToAssets(1 ether);
    }
}
