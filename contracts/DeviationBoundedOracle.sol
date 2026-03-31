// SPDX-License-Identifier: BSD-3-Clause
// SPDX-FileCopyrightText: 2024 Venus
pragma solidity 0.8.25;

import { VBep20Interface } from "./interfaces/VBep20Interface.sol";
import { ResilientOracleInterface } from "./interfaces/OracleInterface.sol";
import { IDeviationBoundedOracle } from "./interfaces/IDeviationBoundedOracle.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { Transient } from "./lib/Transient.sol";

/**
 * @title DeviationBoundedOracle
 * @author Venus
 * @notice The DeviationBoundedOracle provides manipulation-resistant pricing for lending operations.
 *
 * It maintains a per-market rolling min/max price window. When the current spot price deviates
 * significantly from the window bounds, protection mode activates automatically and conservative
 * pricing kicks in:
 *   - Collateral is valued at min(spot, windowMin) — caps collateral value at recent window low
 *   - Debt is valued at max(spot, windowMax) — floors debt value at recent window high
 *
 * This protects against instantaneous or short-duration price manipulation attacks on low-liquidity
 * collateral tokens. Sustained attacks beyond the window period are expected to be handled by
 * off-chain monitoring systems.
 *
 * The oracle exposes both view and non-view price functions. The non-view variants update the
 * price window and trigger protection. The view variants read stored state only. A transient
 * price cache avoids redundant ResilientOracle calls within the same transaction when
 * updateProtectionState is called before the view price reads.
 */
contract DeviationBoundedOracle is AccessControlledV8, IDeviationBoundedOracle {
    /// @notice Per-market protection state tracking the min/max price window
    struct MarketProtectionState {
        /// @notice Lowest price observed in the current window (packed with maxPrice in one slot)
        uint128 minPrice;
        /// @notice Highest price observed in the current window
        uint128 maxPrice;
        /// @notice Whether protection mode is currently active
        bool protectedPriceEnabled;
        /// @notice Timestamp of the last protection trigger — reset on every trigger
        uint64 protectionEnabledAt;
        /// @notice Minimum time protection stays active after last trigger
        uint64 cooldownPeriod;
    }

    /// @notice Minimum allowed threshold value (5%) to account for keeper deadband
    uint256 public constant MIN_THRESHOLD = 5e16;

    /// @notice Maximum allowed threshold value (50%)
    uint256 public constant MAX_THRESHOLD = 50e16;

    /// @notice Resilient Oracle used to fetch spot prices
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    ResilientOracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Transient storage slot for caching spot prices within a transaction
    /// @dev custom:storage-location erc7201:venus-protocol/oracle/DeviationBoundedOracle/cache
    /// keccak256(abi.encode(uint256(keccak256("venus-protocol/oracle/DeviationBoundedOracle/cache")) - 1))
    ///   & ~bytes32(uint256(0xff))
    bytes32 public constant PRICE_CACHE_SLOT = 0x818cfa9b1e1b1cc716656acdb79a94121ed79bfb196bf958683ed2a3277cb200;

    /// @notice Per-market protection state
    mapping(address => MarketProtectionState) public marketProtection;

    /// @notice Per-market entry trigger threshold (mantissa, e.g. 0.1667e18 = 16.67%)
    mapping(address => uint256) public thresholds;

    /// @notice Per-market exit threshold (mantissa, default = threshold/2 for hysteresis)
    mapping(address => uint256) public exitThresholds;

    /// @notice Per-market whitelist — only whitelisted assets use bounded pricing
    mapping(address => bool) public whitelistedAssets;

    /// @notice Emitted when protection is initialized for an asset
    event ProtectionInitialized(
        address indexed asset,
        uint128 minPrice,
        uint128 maxPrice,
        uint64 cooldownPeriod,
        uint256 threshold
    );

    /// @notice Emitted when protection mode is triggered for an asset
    event ProtectionTriggered(address indexed asset, uint256 spotPrice, uint128 minPrice, uint128 maxPrice);

    /// @notice Emitted when protection mode is disabled for an asset
    event ProtectionDisabled(address indexed asset);

    /// @notice Emitted when the keeper updates the minimum price for an asset
    event MinPriceUpdated(address indexed asset, uint128 oldMin, uint128 newMin);

    /// @notice Emitted when the keeper updates the maximum price for an asset
    event MaxPriceUpdated(address indexed asset, uint128 oldMax, uint128 newMax);

    /// @notice Emitted when the price window is expanded
    event WindowExpanded(address indexed asset, uint128 newMin, uint128 newMax);

    /// @notice Emitted when the entry threshold is updated for an asset
    event ThresholdSet(address indexed asset, uint256 oldThreshold, uint256 newThreshold);

    /// @notice Emitted when the exit threshold is updated for an asset
    event ExitThresholdSet(address indexed asset, uint256 oldExitThreshold, uint256 newExitThreshold);

    /// @notice Emitted when the cooldown period is updated for an asset
    event CooldownPeriodSet(address indexed asset, uint64 oldCooldown, uint64 newCooldown);

    /// @notice Emitted when an asset's whitelist status changes
    event WhitelistUpdated(address indexed asset, bool whitelisted);

    /// @notice Thrown when trying to initialize protection for an asset that is not initialized
    error MarketNotInitialized(address asset);

    /// @notice Thrown when trying to initialize an already initialized market
    error MarketAlreadyInitialized(address asset);

    /// @notice Thrown when trying to disable protection that is not active
    error ProtectionNotActive(address asset);

    /// @notice Thrown when trying to disable protection before cooldown has elapsed
    error CooldownNotElapsed(address asset, uint64 protectionEnabledAt, uint64 cooldownPeriod);

    /// @notice Thrown when trying to disable protection before price range has converged
    error PriceRangeNotConverged(address asset, uint256 currentRangeRatio, uint256 exitThreshold);

    /// @notice Thrown when keeper tries to set minPrice above current spot
    error InvalidMinPrice(address asset, uint128 newMin, uint256 currentSpot);

    /// @notice Thrown when keeper tries to set maxPrice below current spot
    error InvalidMaxPrice(address asset, uint128 newMax, uint256 currentSpot);

    /// @notice Thrown when threshold is set below the minimum allowed value
    error ThresholdBelowMinimum(uint256 threshold, uint256 minimum);

    /// @notice Thrown when threshold is set above the maximum allowed value
    error ThresholdAboveMaximum(uint256 threshold, uint256 maximum);

    /// @notice Thrown when minPrice >= maxPrice during initialization
    error InvalidPriceRange(uint128 minPrice, uint128 maxPrice);

    /// @notice Thrown when a price exceeds uint128 max
    error PriceExceedsUint128(uint256 price);

    /**
     * @notice Checks whether an address is null or not
     */
    modifier notNullAddress(address someone) {
        if (someone == address(0)) revert("can't be zero address");
        _;
    }

    /// @notice Constructor for the implementation contract. Sets immutable variables.
    /// @param _resilientOracle Address of the ResilientOracle contract
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(ResilientOracleInterface _resilientOracle) notNullAddress(address(_resilientOracle)) {
        RESILIENT_ORACLE = _resilientOracle;
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract admin
     * @param accessControlManager_ Address of the access control manager contract
     */
    function initialize(address accessControlManager_) external initializer {
        __AccessControlled_init(accessControlManager_);
    }

    // ----- Non-view price functions (update window + trigger protection) -----

    /**
     * @notice Gets the bounded collateral price for a given vToken, updating protection state
     * @dev Fetches spot from ResilientOracle, updates the price window, checks trigger,
     *      and returns the conservative (lower) price when protection is active.
     *      Used by keepers or direct callers who want atomic update + read.
     * @param vToken vToken address
     * @return price The bounded collateral price
     */
    function getBoundedCollateralPrice(address vToken) external returns (uint256) {
        (uint256 spot, address asset) = _getSpotPrice(vToken);

        if (!whitelistedAssets[asset]) return spot;

        MarketProtectionState storage state = marketProtection[asset];

        _updateWindow(state, spot, asset);
        _checkAndTriggerProtection(state, spot, thresholds[asset], asset);

        if (state.protectedPriceEnabled) {
            return _getProtectedCollateralPrice(spot, state);
        }
        return spot;
    }

    /**
     * @notice Gets the bounded debt price for a given vToken, updating protection state
     * @dev Fetches spot from ResilientOracle, updates the price window, checks trigger,
     *      and returns the conservative (higher) price when protection is active.
     *      Used by keepers or direct callers who want atomic update + read.
     * @param vToken vToken address
     * @return price The bounded debt price
     */
    function getBoundedDebtPrice(address vToken) external returns (uint256) {
        (uint256 spot, address asset) = _getSpotPrice(vToken);

        if (!whitelistedAssets[asset]) return spot;

        MarketProtectionState storage state = marketProtection[asset];

        _updateWindow(state, spot, asset);
        _checkAndTriggerProtection(state, spot, thresholds[asset], asset);

        if (state.protectedPriceEnabled) {
            return _getProtectedDebtPrice(spot, state);
        }
        return spot;
    }

    // ----- View price functions (read stored/cached state only) -----

    /**
     * @notice Gets the bounded collateral price for a given vToken (view variant)
     * @dev Reads from transient cache first (populated by a prior updateProtectionState call
     *      in the same transaction). Falls back to ResilientOracle on cache miss.
     *      Returns min(spot, windowMin) when protection is active, spot otherwise.
     * @param vToken vToken address
     * @return price The bounded collateral price
     */
    function getBoundedCollateralPriceView(address vToken) external view returns (uint256) {
        (uint256 spot, address asset) = _getSpotPrice(vToken);

        if (!whitelistedAssets[asset]) return spot;

        MarketProtectionState storage state = marketProtection[asset];

        if (state.protectedPriceEnabled) {
            return _getProtectedCollateralPrice(spot, state);
        }
        return spot;
    }

    /**
     * @notice Gets the bounded debt price for a given vToken (view variant)
     * @dev Reads from transient cache first (populated by a prior updateProtectionState call
     *      in the same transaction). Falls back to ResilientOracle on cache miss.
     *      Returns max(spot, windowMax) when protection is active, spot otherwise.
     * @param vToken vToken address
     * @return price The bounded debt price
     */
    function getBoundedDebtPriceView(address vToken) external view returns (uint256) {
        (uint256 spot, address asset) = _getSpotPrice(vToken);

        if (!whitelistedAssets[asset]) return spot;

        MarketProtectionState storage state = marketProtection[asset];

        if (state.protectedPriceEnabled) {
            return _getProtectedDebtPrice(spot, state);
        }
        return spot;
    }

    // ----- State update (called before view price reads to populate transient cache) -----

    /**
     * @notice Updates the protection state for a given vToken
     * @dev Fetches spot price from ResilientOracle, caches it in transient storage,
     *      expands the price window if spot is a new extreme, and triggers protection
     *      if the deviation threshold is exceeded. Called by PolicyFacet before liquidity
     *      calculations so that subsequent view price reads are gas-efficient.
     * @param vToken vToken address
     */
    function updateProtectionState(address vToken) external {
        (uint256 spot, address asset) = _fetchAndCacheSpot(vToken);

        if (!whitelistedAssets[asset]) return;

        MarketProtectionState storage state = marketProtection[asset];

        _updateWindow(state, spot, asset);
        _checkAndTriggerProtection(state, spot, thresholds[asset], asset);
    }

    // ----- Keeper functions -----

    /**
     * @notice Updates the minimum price in the rolling window for a given asset
     * @dev Called by the keeper to push corrected min values from the off-chain sliding window.
     *      Constraint: newMin must be at or below the current spot price.
     * @param asset The underlying asset address
     * @param newMin The new minimum price
     * @custom:access Only authorized keeper addresses
     */
    function updateMinPrice(address asset, uint128 newMin) external {
        _checkAccessAllowed("updateMinPrice(address,uint128)");
        ensureNonzeroAddress(asset);

        uint256 currentSpot = RESILIENT_ORACLE.getPrice(asset);
        if (uint256(newMin) > currentSpot) revert InvalidMinPrice(asset, newMin, currentSpot);

        MarketProtectionState storage state = marketProtection[asset];
        uint128 oldMin = state.minPrice;
        state.minPrice = newMin;
        emit MinPriceUpdated(asset, oldMin, newMin);
    }

    /**
     * @notice Updates the maximum price in the rolling window for a given asset
     * @dev Called by the keeper to push corrected max values from the off-chain sliding window.
     *      Constraint: newMax must be at or above the current spot price.
     * @param asset The underlying asset address
     * @param newMax The new maximum price
     * @custom:access Only authorized keeper addresses
     */
    function updateMaxPrice(address asset, uint128 newMax) external {
        _checkAccessAllowed("updateMaxPrice(address,uint128)");
        ensureNonzeroAddress(asset);

        uint256 currentSpot = RESILIENT_ORACLE.getPrice(asset);
        if (uint256(newMax) < currentSpot) revert InvalidMaxPrice(asset, newMax, currentSpot);

        MarketProtectionState storage state = marketProtection[asset];
        uint128 oldMax = state.maxPrice;
        state.maxPrice = newMax;
        emit MaxPriceUpdated(asset, oldMax, newMax);
    }

    /**
     * @notice Disables protection mode for a given asset
     * @dev Called by the keeper/monitor after confirming price has normalised.
     *      Enforces two conditions on-chain:
     *      1. Cooldown period has elapsed since the last trigger
     *      2. Price range has converged below the exit threshold
     * @param asset The underlying asset address
     * @custom:access Only authorized monitor/keeper addresses
     * @custom:error ProtectionNotActive if protection is not currently active
     * @custom:error CooldownNotElapsed if cooldown period has not elapsed
     * @custom:error PriceRangeNotConverged if window range is still above exit threshold
     */
    function disableProtection(address asset) external {
        _checkAccessAllowed("disableProtection(address)");

        MarketProtectionState storage state = marketProtection[asset];

        if (!state.protectedPriceEnabled) revert ProtectionNotActive(asset);

        if (block.timestamp < uint256(state.protectionEnabledAt) + uint256(state.cooldownPeriod)) {
            revert CooldownNotElapsed(asset, state.protectionEnabledAt, state.cooldownPeriod);
        }

        // exit protection mode if price range has converged below exit threshold
        uint256 rangeRatio = _getWindowRangeRatio(state);
        if (rangeRatio >= exitThresholds[asset]) {
            revert PriceRangeNotConverged(asset, rangeRatio, exitThresholds[asset]);
        }

        state.protectedPriceEnabled = false;
        emit ProtectionDisabled(asset);
    }

    // ----- Admin functions (governance-gated) -----

    /**
     * @notice Initializes protection for a new asset
     * @dev Sets the initial min/max window, cooldown period, threshold, exit threshold,
     *      and whitelists the asset. Can only be called once per asset.
     * @param asset The underlying asset address
     * @param minPrice Initial minimum price for the window
     * @param maxPrice Initial maximum price for the window
     * @param cooldownPeriod Minimum time protection stays active after last trigger
     * @param threshold Deviation trigger threshold (mantissa). Must be > 5%.
     * @custom:access Only Governance
     * @custom:error MarketAlreadyInitialized if the asset has already been initialized
     * @custom:error InvalidPriceRange if minPrice >= maxPrice or either is zero
     * @custom:error ThresholdBelowMinimum if threshold is below 5%
     * @custom:event ProtectionInitialized
     * @custom:event WhitelistUpdated
     */
    function initializeProtection(
        address asset,
        uint128 minPrice,
        uint128 maxPrice,
        uint64 cooldownPeriod,
        uint256 threshold
    ) external {
        _checkAccessAllowed("initializeProtection(address,uint128,uint128,uint64,uint256)");
        ensureNonzeroAddress(asset);

        if (marketProtection[asset].minPrice != 0) revert MarketAlreadyInitialized(asset);
        if (minPrice == 0 || maxPrice == 0 || minPrice > maxPrice) revert InvalidPriceRange(minPrice, maxPrice);
        if (threshold < MIN_THRESHOLD) revert ThresholdBelowMinimum(threshold, MIN_THRESHOLD);
        if (threshold > MAX_THRESHOLD) revert ThresholdAboveMaximum(threshold, MAX_THRESHOLD);

        marketProtection[asset] = MarketProtectionState({
            minPrice: minPrice,
            maxPrice: maxPrice,
            protectedPriceEnabled: false,
            protectionEnabledAt: 0,
            cooldownPeriod: cooldownPeriod
        });

        thresholds[asset] = threshold;
        exitThresholds[asset] = threshold / 2;
        whitelistedAssets[asset] = true;

        emit ProtectionInitialized(asset, minPrice, maxPrice, cooldownPeriod, threshold);
        emit WhitelistUpdated(asset, true);
    }

    /**
     * @notice Sets the cooldown period for an asset
     * @param asset The underlying asset address
     * @param cooldown The new cooldown period in seconds
     * @custom:access Only Governance
     * @custom:event CooldownPeriodSet
     */
    function setCooldownPeriod(address asset, uint64 cooldown) external {
        _checkAccessAllowed("setCooldownPeriod(address,uint64)");
        ensureNonzeroAddress(asset);

        MarketProtectionState storage state = marketProtection[asset];
        if (state.minPrice == 0) revert MarketNotInitialized(asset);

        uint64 oldCooldown = state.cooldownPeriod;
        state.cooldownPeriod = cooldown;
        emit CooldownPeriodSet(asset, oldCooldown, cooldown);
    }

    /**
     * @notice Sets the entry trigger threshold for an asset
     * @param asset The underlying asset address
     * @param threshold The new threshold (mantissa). Must be > 5%.
     * @custom:access Only Governance
     * @custom:error ThresholdBelowMinimum if threshold is below 5%
     * @custom:event ThresholdSet
     */
    function setThreshold(address asset, uint256 threshold) external {
        _checkAccessAllowed("setThreshold(address,uint256)");
        ensureNonzeroAddress(asset);
        if (threshold < MIN_THRESHOLD) revert ThresholdBelowMinimum(threshold, MIN_THRESHOLD);
        if (threshold > MAX_THRESHOLD) revert ThresholdAboveMaximum(threshold, MAX_THRESHOLD);

        uint256 oldThreshold = thresholds[asset];
        thresholds[asset] = threshold;
        emit ThresholdSet(asset, oldThreshold, threshold);
    }

    /**
     * @notice Sets the exit threshold for an asset
     * @param asset The underlying asset address
     * @param exitThreshold The new exit threshold (mantissa)
     * @custom:access Only Governance
     * @custom:event ExitThresholdSet
     */
    function setExitThreshold(address asset, uint256 exitThreshold) external {
        _checkAccessAllowed("setExitThreshold(address,uint256)");
        ensureNonzeroAddress(asset);
        ensureNonzeroValue(exitThreshold);

        uint256 oldExitThreshold = exitThresholds[asset];
        exitThresholds[asset] = exitThreshold;
        emit ExitThresholdSet(asset, oldExitThreshold, exitThreshold);
    }

    /**
     * @notice Sets whether an asset is whitelisted for bounded pricing
     * @param asset The underlying asset address
     * @param whitelisted Whether the asset should be whitelisted
     * @custom:access Only Governance
     * @custom:event WhitelistUpdated
     */
    function setWhitelisted(address asset, bool whitelisted) external {
        _checkAccessAllowed("setWhitelisted(address,bool)");
        ensureNonzeroAddress(asset);

        whitelistedAssets[asset] = whitelisted;
        emit WhitelistUpdated(asset, whitelisted);
    }

    // ----- View helpers -----

    /**
     * @notice Checks if an asset is whitelisted for bounded pricing
     * @param asset The underlying asset address
     * @return True if the asset is whitelisted
     */
    function isWhitelisted(address asset) external view returns (bool) {
        return whitelistedAssets[asset];
    }

    /**
     * @notice Checks if protection is currently active for an asset
     * @param asset The underlying asset address
     * @return True if protection mode is active
     */
    function isProtected(address asset) external view returns (bool) {
        return marketProtection[asset].protectedPriceEnabled;
    }

    /**
     * @notice Checks if protection can be exited for an asset
     * @dev Returns true when both conditions are met:
     *      1. Cooldown period has elapsed since last trigger
     *      2. Price range has converged below exit threshold
     * @param asset The underlying asset address
     * @return True if protection can be disabled
     */
    function canExitProtection(address asset) external view returns (bool) {
        MarketProtectionState storage state = marketProtection[asset];

        if (!state.protectedPriceEnabled) return false;
        if (block.timestamp < uint256(state.protectionEnabledAt) + uint256(state.cooldownPeriod)) return false;
        if (state.minPrice == 0) return false;

        return _getWindowRangeRatio(state) < exitThresholds[asset];
    }

    // ----- Internal functions -----

    /**
     * @dev Computes the current window range ratio used for exit checks.
     *      Formula: \((maxPrice - minPrice) / minPrice\), scaled by `EXP_SCALE`.
     * @param state The market protection state
     * @return rangeRatio The scaled range ratio \(((max - min) * EXP_SCALE) / min\)
     */
    function _getWindowRangeRatio(MarketProtectionState storage state) internal view returns (uint256) {
        uint256 range = uint256(state.maxPrice) - uint256(state.minPrice);
        return (range * EXP_SCALE) / uint256(state.minPrice);
    }

    /**
     * @dev Fetches the spot price from ResilientOracle and caches it in transient storage
     * @param vToken vToken address
     * @return spot The spot price
     * @return asset The underlying asset address
     */
    function _fetchAndCacheSpot(address vToken) internal returns (uint256 spot, address asset) {
        spot = RESILIENT_ORACLE.getUnderlyingPrice(vToken);
        asset = VBep20Interface(vToken).underlying();
        Transient.cachePrice(PRICE_CACHE_SLOT, asset, spot);
    }

    /**
     * @dev Reads the spot price from transient cache, falling back to ResilientOracle on miss.
     *      Used by view functions to avoid redundant oracle calls when updateProtectionState
     *      has already been called in the same transaction.
     * @param vToken vToken address
     * @return spot The spot price
     */
    function _getSpotPrice(address vToken) internal view returns (uint256 spot, address asset) {
        asset = VBep20Interface(vToken).underlying();
        uint256 cached = Transient.readCachedPrice(PRICE_CACHE_SLOT, asset);
        if (cached != 0) return (cached, asset);
        spot = RESILIENT_ORACLE.getUnderlyingPrice(vToken);
    }

    /**
     * @dev Expands the price window toward extremes if the spot price is a new min or max
     * @param state The market protection state
     * @param spot The current spot price
     * @param asset The underlying asset address (for event emission)
     */
    function _updateWindow(MarketProtectionState storage state, uint256 spot, address asset) internal {
        uint128 spotU128 = _safeToUint128(spot);
        bool expanded;
        if (spotU128 < state.minPrice) {
            state.minPrice = spotU128;
            expanded = true;
        }
        if (spotU128 > state.maxPrice) {
            state.maxPrice = spotU128;
            expanded = true;
        }
        if (expanded) {
            emit WindowExpanded(asset, state.minPrice, state.maxPrice);
        }
    }

    /**
     * @dev Returns the conservative collateral price while protection is active.
     *      Collateral pricing uses `min(spot, windowMin)` to avoid over-valuing collateral.
     * @param spot The current spot price
     * @param state The market protection state (read-only)
     * @return price The bounded collateral price
     */
    function _getProtectedCollateralPrice(
        uint256 spot,
        MarketProtectionState storage state
    ) internal view returns (uint256) {
        uint256 minPrice = uint256(state.minPrice);
        return spot < minPrice ? spot : minPrice;
    }

    /**
     * @dev Returns the conservative debt price while protection is active.
     *      Debt pricing uses `max(spot, windowMax)` to avoid under-valuing debt.
     * @param spot The current spot price
     * @param state The market protection state (read-only)
     * @return price The bounded debt price
     */
    function _getProtectedDebtPrice(uint256 spot, MarketProtectionState storage state) internal view returns (uint256) {
        uint256 maxPrice = uint256(state.maxPrice);
        return spot > maxPrice ? spot : maxPrice;
    }

    /**
     * @dev Checks if the spot price has deviated beyond the threshold and triggers protection
     * @param state The market protection state
     * @param spot The current spot price
     * @param threshold The deviation threshold (mantissa)
     * @param asset The underlying asset address (for event emission)
     */
    function _checkAndTriggerProtection(
        MarketProtectionState storage state,
        uint256 spot,
        uint256 threshold,
        address asset
    ) internal {
        if (threshold == 0) return;

        if (_isDeviationTriggered(spot, state, threshold)) {
            state.protectedPriceEnabled = true;
            state.protectionEnabledAt = uint64(block.timestamp);
            emit ProtectionTriggered(asset, spot, state.minPrice, state.maxPrice);
        }
    }

    /**
     * @dev Checks if spot price has deviated beyond the threshold from window bounds
     *      Pump detection: spot > minPrice * (1 + threshold)
     *      Crash detection: spot < maxPrice * (1 - threshold)
     * @param spot The current spot price
     * @param state The market protection state
     * @param threshold The deviation threshold (mantissa)
     * @return True if deviation is triggered
     */
    function _isDeviationTriggered(
        uint256 spot,
        MarketProtectionState storage state,
        uint256 threshold
    ) internal view returns (bool) {
        uint256 upperBound = (uint256(state.minPrice) * (EXP_SCALE + threshold)) / EXP_SCALE;
        uint256 lowerBound = (uint256(state.maxPrice) * (EXP_SCALE - threshold)) / EXP_SCALE;
        return (spot > upperBound || spot < lowerBound);
    }

    /**
     * @dev Safely casts a uint256 to uint128, reverting on overflow
     * @param value The value to cast
     * @return The value as uint128
     */
    function _safeToUint128(uint256 value) internal pure returns (uint128) {
        if (value > type(uint128).max) revert PriceExceedsUint128(value);
        return uint128(value);
    }
}
