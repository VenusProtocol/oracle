// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IERC4626 } from "../interfaces/IERC4626.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";

/**
 * @title ERC4626Oracle
 * @author Venus
 * @notice This oracle fetches the price of ERC4626 tokens.
 * @dev CAPO (Capped Asset Price Oracle) is mandatory for ERC-4626 tokens to prevent
 * donation-based exchange rate manipulation attacks. The convertToAssets() function
 * can be inflated by directly transferring underlying tokens to the vault contract,
 * which would allow attackers to borrow against artificially inflated collateral.
 */
contract ERC4626Oracle is CorrelatedTokenOracle {
    uint256 public immutable ONE_CORRELATED_TOKEN;

    /// @notice Thrown when CAPO parameters are not set (required for ERC-4626 tokens)
    error CAPORequired();

    /// @notice Constructor for the implementation contract.
    /// @dev Enforces CAPO: annualGrowthRate, snapshotInterval, and initial snapshot values must be non-zero
    constructor(
        address correlatedToken,
        address underlyingToken,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 _snapshotInterval,
        uint256 initialSnapshotMaxExchangeRate,
        uint256 initialSnapshotTimestamp,
        address accessControlManager,
        uint256 _snapshotGap
    )
        CorrelatedTokenOracle(
            correlatedToken,
            underlyingToken,
            resilientOracle,
            annualGrowthRate,
            _snapshotInterval,
            initialSnapshotMaxExchangeRate,
            initialSnapshotTimestamp,
            accessControlManager,
            _snapshotGap
        )
    {
        // ERC-4626 vaults are vulnerable to donation attacks that inflate convertToAssets().
        // CAPO must be active to cap the exchange rate growth and prevent manipulation.
        if (annualGrowthRate == 0 || _snapshotInterval == 0) revert CAPORequired();

        ONE_CORRELATED_TOKEN = 10 ** IERC4626(correlatedToken).decimals();
    }

    /**
     * @notice Fetches the amount of underlying token for 1 correlated token
     * @return amount The amount of underlying token for correlated token
     */
    function getUnderlyingAmount() public view override returns (uint256) {
        return IERC4626(CORRELATED_TOKEN).convertToAssets(ONE_CORRELATED_TOKEN);
    }
}
