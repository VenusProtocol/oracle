// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IPendlePtOracle } from "../interfaces/IPendlePtOracle.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title PendleOracle
 * @author Venus
 * @notice This oracle fetches the price of a pendle token
 * @dev As a base price the oracle uses either the price of the Pendle
 * market's asset (in this case PT_TO_ASSET rate should be used) or
 * the price of the Pendle market's interest bearing token (e.g. wstETH
 * for stETH; in this case PT_TO_SY rate should be used). Technically,
 * interest bearing token is different from standardized yield (SY) token,
 * but since SY is a wrapper around an interest bearing token, we can safely
 * assume the prices of the two are equal. This is not always true for asset
 * price though: using PT_TO_ASSET rate assumes that the yield token can
 * be seamlessly redeemed for the underlying asset. In reality, this might
 * not always be the case. For more details, see
 * https://docs.pendle.finance/Developers/Contracts/StandardizedYield
 */
contract PendleOracle is CorrelatedTokenOracle {
    struct ConstructorParams {
        /// @notice Pendle market
        address market;
        /// @notice Pendle oracle
        address ptOracle;
        /// @notice Either PT_TO_ASSET or PT_TO_SY
        RateKind rateKind;
        /// @notice Pendle PT token
        address ptToken;
        /// @notice Underlying token, can be either the market's asset or the interest bearing token
        address underlyingToken;
        /// @notice Resilient oracle to get the underlying token price from
        address resilientOracle;
        /// @notice TWAP duration to call Pendle oracle with
        uint32 twapDuration;
        /// @notice Annual growth rate of the underlying token
        uint256 annualGrowthRate;
        /// @notice Snapshot interval for the oracle
        uint256 snapshotInterval;
        /// @notice Initial exchange rate of the underlying token
        uint256 initialSnapshotMaxExchangeRate;
        /// @notice Initial timestamp of the underlying token
        uint256 initialSnapshotTimestamp;
        /// @notice Access control manager
        address accessControlManager;
        /// @notice Gap to add when updating the snapshot
        uint256 snapshotGap;
    }

    /// @notice Which asset to use as a base for the returned PT
    /// price. Can be either a standardized yield token (SY), in
    /// this case PT/SY price is returned, or the Pendle
    /// market's asset directly.
    enum RateKind {
        PT_TO_ASSET,
        PT_TO_SY
    }

    /// @notice Address of the PT oracle
    IPendlePtOracle public immutable PT_ORACLE;

    /// @notice Whether to use PT/SY (standardized yield token) rate
    /// or PT/market asset rate
    RateKind public immutable RATE_KIND;

    /// @notice Address of the market
    address public immutable MARKET;

    /// @notice Twap duration for the oracle
    uint32 public immutable TWAP_DURATION;

    /// @notice Decimals of the underlying token
    /// @dev We make an assumption that the underlying decimals will
    /// not change throughout the lifetime of the Pendle market
    uint8 public immutable UNDERLYING_DECIMALS;

    /// @notice Thrown if the duration is invalid
    error InvalidDuration();

    /**
     * @notice Constructor for the implementation contract.
     * @custom:error InvalidDuration Thrown if the duration is invalid
     */
    constructor(
        ConstructorParams memory params
    )
        CorrelatedTokenOracle(
            params.ptToken,
            params.underlyingToken,
            params.resilientOracle,
            params.annualGrowthRate,
            params.snapshotInterval,
            params.initialSnapshotMaxExchangeRate,
            params.initialSnapshotTimestamp,
            params.accessControlManager,
            params.snapshotGap
        )
    {
        ensureNonzeroAddress(params.market);
        ensureNonzeroAddress(params.ptOracle);
        ensureNonzeroValue(params.twapDuration);

        MARKET = params.market;
        PT_ORACLE = IPendlePtOracle(params.ptOracle);
        RATE_KIND = params.rateKind;
        TWAP_DURATION = params.twapDuration;
        UNDERLYING_DECIMALS = IERC20Metadata(UNDERLYING_TOKEN).decimals();

        (bool increaseCardinalityRequired, , bool oldestObservationSatisfied) = PT_ORACLE.getOracleState(
            MARKET,
            TWAP_DURATION
        );
        if (increaseCardinalityRequired || !oldestObservationSatisfied) {
            revert InvalidDuration();
        }
    }

    /// @notice Fetches the amount of underlying token for 1 PT
    /// @return amount The amount of underlying token (either the market's asset
    /// or the yield token) for 1 PT, adjusted for decimals such that the result
    /// has the same precision as the underlying token
    function getUnderlyingAmount() public view override returns (uint256) {
        uint256 rate;
        if (RATE_KIND == RateKind.PT_TO_SY) {
            rate = PT_ORACLE.getPtToSyRate(MARKET, TWAP_DURATION);
        } else {
            rate = PT_ORACLE.getPtToAssetRate(MARKET, TWAP_DURATION);
        }
        return ((10 ** UNDERLYING_DECIMALS) * rate) / 1e18;
    }
}
