// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IERC4626 } from "../interfaces/IERC4626.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";

/**
 * @title ERC4626Oracle
 * @author Venus
 * @notice This oracle fetches the price of ERC4626 tokens
 */
contract ERC4626Oracle is CorrelatedTokenOracle {
    uint256 public immutable ONE_CORRELATED_TOKEN;

    /// @notice Constructor for the implementation contract.
    constructor(
        address correlatedToken,
        address underlyingToken,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 snapshotInterval,
        uint256 initialSnapshotExchangeRate,
        uint256 initialSnapshotTimestamp
    )
        CorrelatedTokenOracle(
            correlatedToken,
            underlyingToken,
            resilientOracle,
            annualGrowthRate,
            snapshotInterval,
            initialSnapshotExchangeRate,
            initialSnapshotTimestamp
        )
    {
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
