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
    IAccountant public immutable ACCOUNTANT;

    /// @notice Constructor for the implementation contract.
    constructor(
        address accountant,
        address weethLRT,
        address weth,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 _snapshotInterval,
        uint256 initialSnapshotMaxExchangeRate,
        uint256 initialSnapshotTimestamp,
        address accessControlManager,
        uint256 _snapshotGap
    )
        CorrelatedTokenOracle(
            weethLRT,
            weth,
            resilientOracle,
            annualGrowthRate,
            _snapshotInterval,
            initialSnapshotMaxExchangeRate,
            initialSnapshotTimestamp,
            accessControlManager,
            _snapshotGap
        )
    {
        ensureNonzeroAddress(accountant);
        ACCOUNTANT = IAccountant(accountant);
    }

    /**
     * @notice Gets the WETH for 1 weETH LRT
     * @return amount Amount of WETH
     */
    function getUnderlyingAmount() public view override returns (uint256) {
        return ACCOUNTANT.getRateSafe();
    }
}
