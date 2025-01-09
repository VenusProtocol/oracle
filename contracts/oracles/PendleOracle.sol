// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IPendlePtOracle } from "../interfaces/IPendlePtOracle.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

/**
 * @title PendleOracle
 * @author Venus
 * @notice This oracle fetches the price of a pendle token
 */
contract PendleOracle is CorrelatedTokenOracle {
    /// @notice Address of the PT oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IPendlePtOracle public immutable PT_ORACLE;

    /// @notice Address of the market
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable MARKET;

    /// @notice Twap duration for the oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint32 public immutable TWAP_DURATION;

    /// @notice Thrown if the duration is invalid
    error InvalidDuration();

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address market,
        address ptOracle,
        address ptToken,
        address underlyingToken,
        address resilientOracle,
        uint32 twapDuration,
        uint256 annualGrowthRate,
        uint256 snapshotInterval
    )
        CorrelatedTokenOracle(
            ptToken,
            underlyingToken,
            resilientOracle,
            annualGrowthRate,
            snapshotInterval
        )
    {
        ensureNonzeroAddress(market);
        ensureNonzeroAddress(ptOracle);
        ensureNonzeroValue(twapDuration);

        MARKET = market;
        PT_ORACLE = IPendlePtOracle(ptOracle);
        TWAP_DURATION = twapDuration;

        (bool increaseCardinalityRequired, , bool oldestObservationSatisfied) = PT_ORACLE.getOracleState(
            MARKET,
            TWAP_DURATION
        );
        if (increaseCardinalityRequired || !oldestObservationSatisfied) {
            revert InvalidDuration();
        }
    }

    /**
     * @notice Fetches the amount of underlying token for 1 pendle token
     * @return amount The amount of underlying token for pendle token
     */
    function _getUnderlyingAmount() internal view override returns (uint256) {
        return PT_ORACLE.getPtToAssetRate(MARKET, TWAP_DURATION);
    }
}
