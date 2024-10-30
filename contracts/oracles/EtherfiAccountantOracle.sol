// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";
import { IAccountant } from "../interfaces/IAccountant.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

/**
 * @title EtherfiAccountantOracle
 * @author Venus
 * @notice This oracle fetches the price of eBTC
 */
contract EtherfiAccountantOracle is CorrelatedTokenOracle {
    /// @notice Address of Accountant
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IAccountant public immutable ACCOUNTANT;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address accountant,
        address eBTC,
        address wbtc,
        address resilientOracle
    ) CorrelatedTokenOracle(eBTC, wbtc, resilientOracle) {
        ensureNonzeroAddress(accountant);
        ACCOUNTANT = IAccountant(accountant);
    }

    /**
     * @notice Gets the WBTC for 1 eBTC
     * @return amount Amount of WBTC
     */
    function _getUnderlyingAmount() internal view override returns (uint256) {
        return ACCOUNTANT.getRateSafe();
    }
}
