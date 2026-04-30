// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

interface IDeviationBoundedOracle {
    // --- Enums ---

    /// @notice Identifies whether a price bound is a minimum or maximum
    enum PriceBoundType {
        MIN,
        MAX
    }

    /// @notice Identifies which keeper action a single syncPriceBoundsAndProtections item performs
    enum KeeperAction {
        SetMinPrice,
        SetMaxPrice,
        ExitProtectionMode
    }

    // --- Structs ---

    /// @notice Per-asset protection state tracking the min/max price window
    struct MarketProtectionState {
        /// @notice Lowest price observed in the current window (packed with maxPrice in one slot)
        uint128 minPrice;
        /// @notice Highest price observed in the current window
        uint128 maxPrice;
        /// @notice Whether protected price is currently being used
        bool currentlyUsingProtectedPrice;
        /// @notice Whether this market is whitelisted for bounded pricing
        bool isBoundedPricingEnabled;
        /// @notice Timestamp of the last protection trigger — reset on every trigger
        uint64 lastProtectionTriggeredAt;
        /// @notice Minimum time protection stays active after last trigger
        uint64 cooldownPeriod;
        /// @notice The underlying asset address, used to verify initialization
        address asset;
        /// @notice Entry deviation threshold (mantissa, e.g. 0.1667e18 = 16.67%); packed with resetThreshold
        uint128 triggerThreshold;
        /// @notice Exit threshold (mantissa); window must converge below this for protection to be disabled
        uint128 resetThreshold;
        /// @notice Whether transient caching of the bounded (collateral, debt) pair is enabled for this asset
        bool cachingEnabled;
    }

    /// @notice One item in an syncPriceBoundsAndProtections payload
    /// @dev `value` is interpreted per-action: the new bound price for SetMinPrice / SetMaxPrice, ignored for ExitProtectionMode
    struct KeeperActionItem {
        address asset;
        KeeperAction action;
        uint256 value;
    }

    /// @notice One item in a setTokenConfigs payload
    struct TokenConfigInput {
        /// @notice The underlying asset address
        address asset;
        /// @notice Minimum time protection stays active after the last trigger (seconds)
        uint64 cooldownPeriod;
        /// @notice Entry deviation threshold (mantissa). Must be between 5% and 50%.
        uint256 triggerThreshold;
        /// @notice Exit deviation threshold (mantissa). Must be non-zero and below triggerThreshold.
        uint256 resetThreshold;
        /// @notice Whether to enable bounded pricing immediately upon initialization
        bool enableBoundedPricing;
        /// @notice Whether transient caching of the bounded (collateral, debt) pair is enabled for this asset
        bool enableCaching;
    }

    // --- Events ---

    /// @notice Emitted when protection is initialized for an asset
    event ProtectionInitialized(
        address indexed asset,
        uint128 minPrice,
        uint128 maxPrice,
        uint64 cooldownPeriod,
        uint256 triggerThreshold
    );

    /// @notice Emitted when protection mode is triggered for an asset
    event ProtectionTriggered(address indexed asset, uint256 spotPrice, uint128 minPrice, uint128 maxPrice);

    /// @notice Emitted when protection mode is disabled for an asset
    event ProtectionModeExited(address indexed asset);

    /// @notice Emitted when the keeper updates the minimum price for an asset
    event MinPriceUpdated(address indexed asset, uint128 oldMin, uint128 newMin);

    /// @notice Emitted when the keeper updates the maximum price for an asset
    event MaxPriceUpdated(address indexed asset, uint128 oldMax, uint128 newMax);

    /// @notice Emitted when the entry threshold is updated for an asset
    event TriggerThresholdSet(address indexed asset, uint256 oldThreshold, uint256 newThreshold);

    /// @notice Emitted when the exit threshold is updated for an asset
    event ResetThresholdSet(address indexed asset, uint256 oldExitThreshold, uint256 newExitThreshold);

    /// @notice Emitted when the cooldown period is updated for an asset
    event CooldownPeriodSet(address indexed asset, uint64 oldCooldown, uint64 newCooldown);

    /// @notice Emitted when an asset's whitelist status changes
    event BoundedPricingWhitelistUpdated(address indexed asset, bool whitelisted);

    /// @notice Emitted when the per-asset transient caching flag is toggled
    event CachingEnabledUpdated(address indexed asset, bool oldEnabled, bool newEnabled);

    // --- Errors ---

    /// @notice Thrown when trying to use or update protection for an asset that has not been initialized
    error MarketNotInitialized(address asset);

    /// @notice Thrown when trying to initialize an already initialized market
    error MarketAlreadyInitialized(address asset);

    /// @notice Thrown when trying to disable protection that is not active
    error ProtectedPriceInactive(address asset);

    /// @notice Thrown when trying to disable protection before cooldown has elapsed
    error CooldownNotElapsed(address asset, uint64 lastProtectionTriggeredAt, uint64 cooldownPeriod);

    /// @notice Thrown when trying to disable protection before price range has converged
    error PriceRangeNotConverged(address asset, uint256 currentRangeRatio, uint256 resetThreshold);

    /// @notice Thrown when keeper tries to set minPrice above current spot
    error InvalidMinPrice(address asset, uint128 newMin, uint256 currentSpot);

    /// @notice Thrown when keeper tries to set maxPrice below current spot
    error InvalidMaxPrice(address asset, uint128 newMax, uint256 currentSpot);

    /// @notice Thrown when threshold is set below the minimum allowed value
    error ThresholdBelowMinimum(uint256 threshold, uint256 minimum);

    /// @notice Thrown when threshold is set above the maximum allowed value
    error ThresholdAboveMaximum(uint256 threshold, uint256 maximum);

    /// @notice Thrown when a price exceeds uint128 max
    error PriceExceedsUint128(uint256 price);

    /// @notice Thrown when a zero price is provided where a non-zero price is required
    error ZeroPriceNotAllowed();

    /// @notice Thrown when trying to initialize protection for VAI
    error VAINotAllowed();

    /// @notice Thrown when trying to disable bounded pricing for an asset while protection is active
    error ProtectedPriceActive(address asset);

    /// @notice Thrown when the lengths of the arrays are not equal
    error InvalidArrayLength();

    /// @notice Thrown when the exit threshold is set at or above the trigger threshold
    error InvalidResetThreshold(uint256 resetThreshold);

    /// @notice Thrown when an syncPriceBoundsAndProtections item carries an unsupported action enum value
    error InvalidKeeperAction(uint8 action);

    // --- Non-view price functions (update window + trigger protection) ---

    /**
     * @notice Gets the bounded collateral price for a given vToken, updating protection state
     * @param vToken vToken address
     * @return collateralPrice The bounded collateral price
     * @custom:error PriceExceedsUint128 if the spot price overflows uint128
     * @custom:event MinPriceUpdated if a new window minimum is recorded
     * @custom:event MaxPriceUpdated if a new window maximum is recorded
     * @custom:event ProtectionTriggered if the spot price deviates beyond the threshold
     */
    function getBoundedCollateralPrice(address vToken) external returns (uint256 collateralPrice);

    /**
     * @notice Gets the bounded debt price for a given vToken, updating protection state
     * @param vToken vToken address
     * @return debtPrice The bounded debt price
     * @custom:error PriceExceedsUint128 if the spot price overflows uint128
     * @custom:event MinPriceUpdated if a new window minimum is recorded
     * @custom:event MaxPriceUpdated if a new window maximum is recorded
     * @custom:event ProtectionTriggered if the spot price deviates beyond the threshold
     */
    function getBoundedDebtPrice(address vToken) external returns (uint256 debtPrice);

    /**
     * @notice Gets both the bounded collateral and debt prices for a given vToken, updating protection state
     * @param vToken vToken address
     * @return collateralPrice The bounded collateral price
     * @return debtPrice The bounded debt price
     * @custom:error PriceExceedsUint128 if the spot price overflows uint128
     * @custom:event MinPriceUpdated if a new window minimum is recorded
     * @custom:event MaxPriceUpdated if a new window maximum is recorded
     * @custom:event ProtectionTriggered if the spot price deviates beyond the threshold
     */
    function getBoundedPrices(address vToken) external returns (uint256 collateralPrice, uint256 debtPrice);

    // --- State update (call before view price reads to populate transient cache) ---

    /**
     * @notice Updates the protection state for a given vToken, caching the resolved collateral and debt prices
     * @dev Called by PolicyFacet before liquidity calculations so subsequent view price
     *      reads in the same transaction are served from transient storage. The transient
     *      cache is only populated when the asset's `cachingEnabled` flag is `true`.
     * @param vToken vToken address
     * @custom:error PriceExceedsUint128 if the spot price overflows uint128
     * @custom:event MinPriceUpdated if a new window minimum is recorded
     * @custom:event MaxPriceUpdated if a new window maximum is recorded
     * @custom:event ProtectionTriggered if the spot price deviates beyond the threshold
     */
    function updateProtectionState(address vToken) external;

    // --- View price functions (read stored/cached state only) ---

    /**
     * @notice Gets the bounded collateral price for a given vToken (view variant)
     * @dev Reads from transient cache first when the asset's `cachingEnabled` flag is `true`;
     *      falls back to ResilientOracle on cache miss or when caching is disabled.
     * @param vToken vToken address
     * @return price The bounded collateral price
     * @custom:error PriceExceedsUint128 if the spot price overflows uint128 (cache miss path only)
     */
    function getBoundedCollateralPriceView(address vToken) external view returns (uint256 price);

    /**
     * @notice Gets the bounded debt price for a given vToken (view variant)
     * @dev Reads from transient cache first when the asset's `cachingEnabled` flag is `true`;
     *      falls back to ResilientOracle on cache miss or when caching is disabled.
     * @param vToken vToken address
     * @return price The bounded debt price
     * @custom:error PriceExceedsUint128 if the spot price overflows uint128 (cache miss path only)
     */
    function getBoundedDebtPriceView(address vToken) external view returns (uint256 price);

    /**
     * @notice Gets both the bounded collateral and debt prices for a given vToken (view variant)
     * @dev Reads from transient cache first when the asset's `cachingEnabled` flag is `true`;
     *      falls back to ResilientOracle on cache miss or when caching is disabled.
     * @param vToken vToken address
     * @return collateralPrice The bounded collateral price
     * @return debtPrice The bounded debt price
     * @custom:error PriceExceedsUint128 if the spot price overflows uint128 (cache miss path only)
     */
    function getBoundedPricesView(address vToken) external view returns (uint256 collateralPrice, uint256 debtPrice);

    // --- Keeper functions ---

    /**
     * @notice Updates the minimum price in the rolling window for a given asset
     * @param asset The underlying asset address
     * @param newMin The new minimum price; must be at or below the current spot and below maxPrice
     * @custom:access Only authorized keeper addresses
     * @custom:error ZeroPriceNotAllowed if newMin is zero
     * @custom:error MarketNotInitialized if the asset has not been initialized
     * @custom:error InvalidMinPrice if newMin exceeds the current spot or is at or above maxPrice
     * @custom:event MinPriceUpdated
     */
    function updateMinPrice(address asset, uint128 newMin) external;

    /**
     * @notice Updates the maximum price in the rolling window for a given asset
     * @param asset The underlying asset address
     * @param newMax The new maximum price; must be at or above the current spot and above minPrice
     * @custom:access Only authorized keeper addresses
     * @custom:error ZeroPriceNotAllowed if newMax is zero
     * @custom:error MarketNotInitialized if the asset has not been initialized
     * @custom:error InvalidMaxPrice if newMax is below the current spot or is at or below minPrice
     * @custom:event MaxPriceUpdated
     */
    function updateMaxPrice(address asset, uint128 newMax) external;

    /**
     * @notice Exits protection mode for a given asset once conditions are met
     * @param asset The underlying asset address
     * @custom:access Only authorized monitor/keeper addresses
     * @custom:error ProtectedPriceInactive if protection is not currently active
     * @custom:error CooldownNotElapsed if the cooldown period has not elapsed since the last trigger
     * @custom:error PriceRangeNotConverged if the window range is still above the exit threshold
     * @custom:event ProtectionModeExited
     */
    function exitProtectionMode(address asset) external;

    /**
     * @notice Dispatches a batch of keeper-only actions (set min, set max, or exit protection) under a single ACM check
     * @dev Each item is processed in array order; any item revert rolls back the whole batch.
     *      `value` is interpreted as the new bound price for SetMinPrice / SetMaxPrice and ignored for ExitProtectionMode.
     *      Empty `actions` is a no-op success.
     * @param actions The list of keeper actions to apply
     * @custom:access Only authorized keeper addresses
     * @custom:error InvalidKeeperAction if an item carries an unsupported action enum value
     * @custom:error PriceExceedsUint128 if a SetMin/SetMax item value overflows uint128
     * @custom:error ZeroPriceNotAllowed if a SetMin/SetMax item value is zero
     * @custom:error MarketNotInitialized if any referenced asset has not been initialized
     * @custom:error InvalidMinPrice if a SetMinPrice item violates the spot/maxPrice constraints
     * @custom:error InvalidMaxPrice if a SetMaxPrice item violates the spot/minPrice constraints
     * @custom:error ProtectedPriceInactive if an ExitProtectionMode item targets an asset whose protection is not active
     * @custom:error CooldownNotElapsed if an ExitProtectionMode item is submitted before cooldown elapsed
     * @custom:error PriceRangeNotConverged if an ExitProtectionMode item is submitted before window convergence
     * @custom:event MinPriceUpdated, MaxPriceUpdated, ProtectionModeExited
     */
    function syncPriceBoundsAndProtections(KeeperActionItem[] calldata actions) external;

    // --- Admin functions (governance-gated) ---

    /**
     * @notice Initializes protection parameters for a new asset
     * @dev Seeds the initial min/max window from the current ResilientOracle spot price,
     *      confirming the oracle is live for this asset before it is listed.
     * @param tokenConfig_ Token config input for the asset
     * @custom:access Only Governance
     * @custom:error ZeroAddressNotAllowed if asset is the zero address
     * @custom:error ZeroValueNotAllowed if cooldownPeriod, triggerThreshold, or resetThreshold is zero
     * @custom:error MarketAlreadyInitialized if the asset has already been initialized
     * @custom:error ThresholdBelowMinimum if triggerThreshold is below 5%
     * @custom:error ThresholdAboveMaximum if triggerThreshold is above 50%
     * @custom:error InvalidResetThreshold if resetThreshold is at or above triggerThreshold
     * @custom:error VAINotAllowed if asset is the VAI token
     * @custom:error PriceExceedsUint128 if the spot price overflows uint128
     * @custom:event ProtectionInitialized
     * @custom:event BoundedPricingWhitelistUpdated
     */
    function setTokenConfig(TokenConfigInput calldata tokenConfig_) external;

    /**
     * @notice Batch-initializes protection parameters for multiple assets in a single transaction
     * @param tokenConfigs_ Array of token config inputs, one per asset
     * @custom:access Only Governance
     * @custom:error InvalidArrayLength if the input array is empty
     * @custom:error ZeroAddressNotAllowed if any asset is the zero address
     * @custom:error ZeroValueNotAllowed if any cooldownPeriod, triggerThreshold, or resetThreshold is zero
     * @custom:error MarketAlreadyInitialized if any asset has already been initialized
     * @custom:error ThresholdBelowMinimum if any triggerThreshold is below 5%
     * @custom:error ThresholdAboveMaximum if any triggerThreshold is above 50%
     * @custom:error InvalidResetThreshold if any resetThreshold is at or above its triggerThreshold
     * @custom:error VAINotAllowed if any asset is the VAI token
     * @custom:error PriceExceedsUint128 if the spot price for any asset overflows uint128
     * @custom:event ProtectionInitialized for each asset
     * @custom:event BoundedPricingWhitelistUpdated for each asset
     */
    function setTokenConfigs(TokenConfigInput[] calldata tokenConfigs_) external;

    /**
     * @notice Sets the cooldown period for an asset
     * @param asset The underlying asset address
     * @param newCooldown The new cooldown period in seconds; must be non-zero
     * @custom:access Only Governance
     * @custom:error MarketNotInitialized if the asset has not been initialized
     * @custom:event CooldownPeriodSet
     */
    function setCooldownPeriod(address asset, uint64 newCooldown) external;

    /**
     * @notice Sets the trigger and reset thresholds for an asset
     * @param asset The underlying asset address
     * @param newTriggerThreshold The new trigger threshold (mantissa). Must be between 5% and 50% and above the reset threshold.
     * @param newResetThreshold The new reset threshold (mantissa). Must be non-zero and below the trigger threshold.
     * @custom:access Only Governance
     * @custom:error MarketNotInitialized if the asset has not been initialized
     * @custom:error ThresholdBelowMinimum if newTriggerThreshold is below 5%
     * @custom:error ThresholdAboveMaximum if newTriggerThreshold is above 50%
     * @custom:error InvalidResetThreshold if newResetThreshold is at or above newTriggerThreshold
     * @custom:event TriggerThresholdSet if the trigger threshold changed
     * @custom:event ResetThresholdSet if the reset threshold changed
     */
    function setThresholds(address asset, uint256 newTriggerThreshold, uint256 newResetThreshold) external;

    /**
     * @notice Sets whether bounded pricing is enabled for an asset
     * @param asset The underlying asset address
     * @param enabled Whether bounded pricing should be enabled for the asset
     * @custom:access Only Governance
     * @custom:error MarketNotInitialized if the asset has not been initialized
     * @custom:error ProtectedPriceActive if trying to disable an asset while protection is active
     * @custom:event BoundedPricingWhitelistUpdated
     */
    function setAssetBoundedPricingEnabled(address asset, bool enabled) external;

    /**
     * @notice Toggles transient caching of the bounded (collateral, debt) pair for an asset
     * @dev When disabled, each view/non-view price call recomputes bounded prices from the
     *      live spot instead of reading or writing the transient slots. The initial value is
     *      set via the `enableCaching` argument of `setTokenConfig`.
     * @param asset The underlying asset address
     * @param enabled Whether transient caching is enabled for this asset
     * @custom:access Only Governance
     * @custom:error MarketNotInitialized if the asset has not been initialized
     * @custom:event CachingEnabledUpdated
     */
    function setCachingEnabled(address asset, bool enabled) external;

    // --- View helpers ---

    /**
     * @notice Returns the full protection state for an asset
     * @param asset The underlying asset address
     * @return minPrice Lowest price observed in the current window
     * @return maxPrice Highest price observed in the current window
     * @return currentlyUsingProtectedPrice Whether protected price is currently active
     * @return isBoundedPricingEnabled Whether the asset is whitelisted for bounded pricing
     * @return lastProtectionTriggeredAt Timestamp of the last protection trigger
     * @return cooldownPeriod Minimum time protection stays active after last trigger
     * @return assetAddr The underlying asset address stored in the struct
     * @return triggerThreshold Entry deviation threshold (mantissa) that activates protection
     * @return resetThreshold Exit deviation threshold (mantissa) below which protection can be disabled
     * @return cachingEnabled Whether transient caching of the bounded pair is enabled for the asset
     */
    function assetProtectionConfig(
        address asset
    )
        external
        view
        returns (
            uint128 minPrice,
            uint128 maxPrice,
            bool currentlyUsingProtectedPrice,
            bool isBoundedPricingEnabled,
            uint64 lastProtectionTriggeredAt,
            uint64 cooldownPeriod,
            address assetAddr,
            uint128 triggerThreshold,
            uint128 resetThreshold,
            bool cachingEnabled
        );

    /**
     * @notice Checks if an asset is whitelisted for bounded pricing
     * @param asset The underlying asset address
     * @return True if the asset is whitelisted
     */
    function isBoundedPricingEnabled(address asset) external view returns (bool);

    /**
     * @notice Checks if the asset is currently using the protected (bounded) price
     * @param asset The underlying asset address
     * @return True if the asset is currently using the protected price instead of spot
     */
    function currentlyUsingProtectedPrice(address asset) external view returns (bool);

    /**
     * @notice Checks if protection can be exited for a given asset
     * @param asset The underlying asset address
     * @return True if both the cooldown has elapsed and the price range has converged below the exit threshold
     */
    function canExitProtection(address asset) external view returns (bool);

    /**
     * @notice Returns the initialized asset at the given index (auto-generated array getter)
     * @param index Array index
     * @return The asset address at the given index
     */
    function allAssets(uint256 index) external view returns (address);

    /**
     * @notice Returns all currently whitelisted asset addresses
     * @return result Array of whitelisted asset addresses
     */
    function getAllBoundedPricingEnabledAssets() external view returns (address[] memory result);

    /**
     * @notice Returns all asset addresses that have ever been initialized
     * @return Array of all initialized asset addresses
     */
    function getInitializedAssets() external view returns (address[] memory);

    /**
     * @notice Batch-checks which assets' on-chain min/max have drifted beyond the keeper deadband
     * @param assets Array of asset addresses to check
     * @param proposedMins Keeper's proposed window minimum prices
     * @param proposedMaxs Keeper's proposed window maximum prices
     * @return needsMinUpdate Whether minPrice drift exceeds the deadband for each asset
     * @return needsMaxUpdate Whether maxPrice drift exceeds the deadband for each asset
     * @custom:error InvalidArrayLength if the input array lengths do not match
     */
    function checkAndGetWindowDrift(
        address[] calldata assets,
        uint128[] calldata proposedMins,
        uint128[] calldata proposedMaxs
    ) external view returns (bool[] memory needsMinUpdate, bool[] memory needsMaxUpdate);
}
