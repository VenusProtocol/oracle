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
    /// @notice Which asset to use as a base for the returned PT
    /// price. Can be either a standardized yield token (SY), in
    /// this case PT/SY price is returned, or the underlying
    /// asset directly. Note that using PT_TO_ASSET rate assumes
    /// that the yield token can be seamlessly redeemed for the
    /// underlying asset. In reality, this might not always be
    /// the case. For more details, see
    /// https://docs.pendle.finance/Developers/Contracts/StandardizedYield
    enum RateKind {
        PT_TO_ASSET,
        PT_TO_SY
    }

    /// @notice Address of the PT oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IPendlePtOracle public immutable PT_ORACLE;

    /// @notice Whether to use PT/SY (standardized yield token) rate
    /// or PT/underlying asset rate
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    RateKind public immutable RATE_KIND;

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
        RateKind rateKind,
        address ptToken,
        address underlyingToken,
        address resilientOracle,
        uint32 twapDuration
    ) CorrelatedTokenOracle(ptToken, underlyingToken, resilientOracle) {
        ensureNonzeroAddress(market);
        ensureNonzeroAddress(ptOracle);
        ensureNonzeroValue(twapDuration);

        MARKET = market;
        PT_ORACLE = IPendlePtOracle(ptOracle);
        RATE_KIND = rateKind;
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
     * @notice Fetches the amount of underlying or SY token for 1 pendle token
     * @return amount The amount of underlying or SY token for pendle token
     */
    function _getUnderlyingAmount() internal view override returns (uint256) {
        if (RATE_KIND == RateKind.PT_TO_SY) {
            return PT_ORACLE.getPtToSyRate(MARKET, TWAP_DURATION);
        }
        return PT_ORACLE.getPtToAssetRate(MARKET, TWAP_DURATION);
    }
}
