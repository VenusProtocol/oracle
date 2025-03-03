// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";
import { IAccountant } from "../interfaces/IAccountant.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

/**
 * @title WeETHAccountantOracle
 * @author Venus
 * @notice This oracle fetches the price of Ether.fi tokens based on an `Accountant` contract (i.e. weETHs and weETHk)
 */
contract WeETHAccountantOracle is CorrelatedTokenOracle {
    /// @notice Address of Accountant
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IAccountant public immutable ACCOUNTANT;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address accountant,
        address weethLRT,
        address weth,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 snapshotInterval,
        uint256 initialSnapshotExchangeRate,
        uint256 initialSnapshotTimestamp
    )
        CorrelatedTokenOracle(
            weethLRT,
            weth,
            resilientOracle,
            annualGrowthRate,
            snapshotInterval,
            initialSnapshotExchangeRate,
            initialSnapshotTimestamp
        )
    {
        ensureNonzeroAddress(accountant);
        ACCOUNTANT = IAccountant(accountant);
    }

    /**
     * @notice Gets the WETH for 1 weETH LRT
     * @return amount Amount of WETH
     */
    function _getUnderlyingAmount() internal view override returns (uint256) {
        return ACCOUNTANT.getRateSafe();
    }
}
