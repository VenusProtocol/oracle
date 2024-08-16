// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";
import { IAccountantWithRateProviders } from "../interfaces/IAccountantWithRateProviders.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

/**
 * @title WeETHAccountantOracle
 * @author Venus
 * @notice This oracle fetches the price of ether.fi restaked token
 */
contract WeETHAccountantOracle is CorrelatedTokenOracle {
    /// @notice Address of AccountantWithRateProviders
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IAccountantWithRateProviders public immutable ACCOUNTANT;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address accountant,
        address LRT,
        address WETH,
        address resilientOracle
    ) CorrelatedTokenOracle(LRT, WETH, resilientOracle) {
        ensureNonzeroAddress(accountant);
        ACCOUNTANT = IAccountantWithRateProviders(accountant);
    }

    /**
     * @notice Gets the WETH for 1 LRT
     * @return amount Amount of WETH
     */
    function _getUnderlyingAmount() internal view override returns (uint256) {
        return ACCOUNTANT.getRate();
    }
}
