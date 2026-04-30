// SPDX-License-Identifier: BSD-3-Clause
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
    /// @notice Minimum allowed threshold value (5%) to account for keeper deadband
    uint256 public constant MIN_THRESHOLD = 5e16;

    /// @notice Maximum allowed threshold value (50%)
    uint256 public constant MAX_THRESHOLD = 50e16;

    /// @notice Keeper deadband threshold (5%) — min/max corrections below this are suppressed
    uint256 public constant KEEPER_DEADBAND = 5e16;

    /// @notice Resilient Oracle used to fetch spot prices
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    ResilientOracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Native market address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable nativeMarket;

    /// @notice VAI address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vai;

    /// @notice Transient storage slot for caching final collateral prices within a transaction
    /// @dev custom:storage-location erc7201:venus-protocol/oracle/DeviationBoundedOracle/collateralCache
    /// keccak256(abi.encode(uint256(keccak256("venus-protocol/oracle/DeviationBoundedOracle/collateralCache")) - 1))
    ///   & ~bytes32(uint256(0xff))
    bytes32 public constant COLLATERAL_PRICE_CACHE_SLOT =
        0x7bd9fcecef8429101f34baefb335883a97edd91e0d8fdc455d73ab727abf7000;

    /// @notice Transient storage slot for caching final debt prices within a transaction
    /// @dev custom:storage-location erc7201:venus-protocol/oracle/DeviationBoundedOracle/debtCache
    /// keccak256(abi.encode(uint256(keccak256("venus-protocol/oracle/DeviationBoundedOracle/debtCache")) - 1))
    ///   & ~bytes32(uint256(0xff))
    bytes32 public constant DEBT_PRICE_CACHE_SLOT = 0x84d6ca795decc666d3d1d524cbbadd8a1e0e0279db766fe7a1b41b1eb8970600;

    /// @notice Set this as asset address for Native token on each chain.This is the underlying for vBNB (on bsc)
    /// and can serve as any underlying asset of a market that supports native tokens
    address public constant NATIVE_TOKEN_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice Per-asset protection state
    mapping(address => MarketProtectionState) public assetProtectionConfig;

    /// @notice Append-only array of all assets ever initialized, used for enumeration
    address[] public allAssets;

    /// @notice Storage gap for upgrades
    uint256[48] private __gap;

    /**
     * @notice Constructor for the implementation contract. Sets immutable variables.
     * @param _resilientOracle Address of the ResilientOracle contract
     * @param nativeMarketAddress The address of a native market (for bsc it would be vBNB address)
     * @param vaiAddress The address of the VAI token, or address(0) if VAI is not deployed on the chain.
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor(ResilientOracleInterface _resilientOracle, address nativeMarketAddress, address vaiAddress) {
        ensureNonzeroAddress(address(_resilientOracle));
        ensureNonzeroAddress(nativeMarketAddress);
        RESILIENT_ORACLE = _resilientOracle;
        nativeMarket = nativeMarketAddress;
        vai = vaiAddress;
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
     * @return collateralPrice The bounded collateral price
     * @custom:event MinPriceUpdated if a new window minimum is recorded
     * @custom:event MaxPriceUpdated if a new window maximum is recorded
     * @custom:event ProtectionTriggered if the spot price deviates beyond the threshold
     */
    function getBoundedCollateralPrice(address vToken) external returns (uint256 collateralPrice) {
        (collateralPrice, ) = _updateAndGetBoundedPrices(vToken);
    }

    /**
     * @notice Gets the bounded debt price for a given vToken, updating protection state
     * @dev Fetches spot from ResilientOracle, updates the price window, checks trigger,
     *      and returns the conservative (higher) price when protection is active.
     *      Used by keepers or direct callers who want atomic update + read.
     * @param vToken vToken address
     * @return debtPrice The bounded debt price
     * @custom:event MinPriceUpdated if a new window minimum is recorded
     * @custom:event MaxPriceUpdated if a new window maximum is recorded
     * @custom:event ProtectionTriggered if the spot price deviates beyond the threshold
     */
    function getBoundedDebtPrice(address vToken) external returns (uint256 debtPrice) {
        (, debtPrice) = _updateAndGetBoundedPrices(vToken);
    }

    /**
     * @notice Gets both the bounded collateral and debt prices for a given vToken, updating protection state
     * @dev Fetches spot from ResilientOracle, updates the price window, checks trigger,
     *      and returns both conservative prices in a single call.
     * @param vToken vToken address
     * @return collateralPrice The bounded collateral price
     * @return debtPrice The bounded debt price
     * @custom:event MinPriceUpdated if a new window minimum is recorded
     * @custom:event MaxPriceUpdated if a new window maximum is recorded
     * @custom:event ProtectionTriggered if the spot price deviates beyond the threshold
     */
    function getBoundedPrices(address vToken) external returns (uint256 collateralPrice, uint256 debtPrice) {
        return _updateAndGetBoundedPrices(vToken);
    }

    /**
     * @notice Fetches the spot price, updates the protection window, and caches the resolved
     *         collateral and debt prices in transient storage for the duration of the transaction.
     * @dev Call this once per vToken at the start of a transaction (e.g. from PolicyFacet before
     *      liquidity calculations). Subsequent calls to getBoundedCollateralPriceView /
     *      getBoundedDebtPriceView within the same transaction will read from the transient cache
     *      instead of querying ResilientOracle again, keeping those functions as `view` and
     *      avoiding redundant oracle calls.
     *      The transient cache is only populated when the asset's `cachingEnabled` flag is `true`.
     *      When caching is disabled, view price reads fall through to live recomputation.
     *      Permissionless: anyone can call this, both for gas optimisation and to ensure every
     *      caller in the same transaction reads the correct, up-to-date bounded price.
     * @param vToken vToken address
     * @custom:event MinPriceUpdated if a new window minimum is recorded
     * @custom:event MaxPriceUpdated if a new window maximum is recorded
     * @custom:event ProtectionTriggered if the spot price deviates beyond the threshold
     */
    function updateProtectionState(address vToken) external {
        _updateAndGetBoundedPrices(vToken);
    }

    // ----- View price functions (read stored/cached state only) -----

    /**
     * @notice Gets the bounded collateral price for a given vToken (view variant)
     * @dev Reads from transient cache first when the asset's `cachingEnabled` flag is `true`
     *      (populated by a prior updateProtectionState call in the same transaction). Falls back
     *      to ResilientOracle on cache miss or when caching is disabled.
     *      Returns min(spot, windowMin) when protection is active, spot otherwise.
     * @param vToken vToken address
     * @return collateralPrice The bounded collateral price
     */
    function getBoundedCollateralPriceView(address vToken) external view returns (uint256 collateralPrice) {
        (collateralPrice, ) = _computeBoundedPrices(vToken);
    }

    /**
     * @notice Gets the bounded debt price for a given vToken (view variant)
     * @dev Reads from transient cache first when the asset's `cachingEnabled` flag is `true`
     *      (populated by a prior updateProtectionState call in the same transaction). Falls back
     *      to ResilientOracle on cache miss or when caching is disabled.
     *      Returns max(spot, windowMax) when protection is active, spot otherwise.
     * @param vToken vToken address
     * @return debtPrice The bounded debt price
     */
    function getBoundedDebtPriceView(address vToken) external view returns (uint256 debtPrice) {
        (, debtPrice) = _computeBoundedPrices(vToken);
    }

    /**
     * @notice Gets both the bounded collateral and debt prices for a given vToken (view variant)
     * @dev Reads from transient cache first when the asset's `cachingEnabled` flag is `true`;
     *      falls back to ResilientOracle on cache miss or when caching is disabled.
     * @param vToken vToken address
     * @return collateralPrice The bounded collateral price
     * @return debtPrice The bounded debt price
     */
    function getBoundedPricesView(address vToken) external view returns (uint256 collateralPrice, uint256 debtPrice) {
        return _computeBoundedPrices(vToken);
    }

    // ----- Keeper functions -----

    /**
     * @notice Updates the minimum price in the rolling window for a given asset
     * @dev Called by the keeper to push corrected min values from the off-chain sliding window.
     *      Constraint: newMin must be at or below the current spot price.
     * @param asset The underlying asset address
     * @param newMin The new minimum price
     * @custom:access Only authorized keeper addresses
     * @custom:event MinPriceUpdated
     */
    function updateMinPrice(address asset, uint128 newMin) external {
        _checkAccessAllowed("updateMinPrice(address,uint128)");
        _validateAndUpdateBound(asset, newMin, PriceBoundType.MIN);
    }

    /**
     * @notice Updates the maximum price in the rolling window for a given asset
     * @dev Called by the keeper to push corrected max values from the off-chain sliding window.
     *      Constraint: newMax must be at or above the current spot price.
     * @param asset The underlying asset address
     * @param newMax The new maximum price
     * @custom:access Only authorized keeper addresses
     * @custom:event MaxPriceUpdated
     */
    function updateMaxPrice(address asset, uint128 newMax) external {
        _checkAccessAllowed("updateMaxPrice(address,uint128)");
        _validateAndUpdateBound(asset, newMax, PriceBoundType.MAX);
    }

    /**
     * @notice Exits protection mode for a given asset
     * @dev Called by the keeper/monitor after confirming price has normalised.
     *      Enforces two conditions on-chain:
     *      1. Cooldown period has elapsed since the last trigger
     *      2. Price range has converged below the exit threshold
     * @param asset The underlying asset address
     * @custom:access Only authorized monitor/keeper addresses
     * @custom:error ProtectedPriceInactive if protection is not currently active
     * @custom:error CooldownNotElapsed if cooldown period has not elapsed
     * @custom:error PriceRangeNotConverged if window range is still above exit threshold
     * @custom:event ProtectionModeExited
     */
    function exitProtectionMode(address asset) external {
        _checkAccessAllowed("exitProtectionMode(address)");
        _exitProtectionMode(asset);
    }

    /**
     * @notice Dispatches a batch of keeper-only actions (set min, set max, or exit protection) under a single ACM check
     * @dev Each item is processed in array order; any item revert rolls back the whole batch.
     *      `value` is interpreted as the new bound price for SetMinPrice / SetMaxPrice and ignored for ExitProtectionMode.
     *      Empty `actions` is a no-op success.
     * @param actions The list of keeper actions to apply
     * @custom:access Only authorized keeper addresses
     * @custom:error InvalidKeeperAction if an item carries an unsupported action enum value
     * @custom:event MinPriceUpdated, MaxPriceUpdated, ProtectionModeExited
     */
    function syncPriceBoundsAndProtections(KeeperActionItem[] calldata actions) external {
        _checkAccessAllowed("syncPriceBoundsAndProtections((address,uint8,uint256)[])");
        uint256 len = actions.length;
        for (uint256 i; i < len; ++i) {
            KeeperActionItem calldata item = actions[i];
            if (item.action == KeeperAction.SetMinPrice) {
                _validateAndUpdateBound(item.asset, _safeToUint128(item.value), PriceBoundType.MIN);
            } else if (item.action == KeeperAction.SetMaxPrice) {
                _validateAndUpdateBound(item.asset, _safeToUint128(item.value), PriceBoundType.MAX);
            } else if (item.action == KeeperAction.ExitProtectionMode) {
                _exitProtectionMode(item.asset);
            } else {
                revert InvalidKeeperAction(uint8(item.action));
            }
        }
    }

    // ----- Admin functions (governance-gated) -----

    /**
     * @notice Initializes protection for a new asset
     * @param tokenConfig_ Token config input for the asset
     * @custom:access Only Governance
     * @custom:event ProtectionInitialized
     * @custom:event BoundedPricingWhitelistUpdated
     */
    function setTokenConfig(TokenConfigInput calldata tokenConfig_) external {
        _checkAccessAllowed("setTokenConfig((address,uint64,uint256,uint256,bool,bool))");
        _setTokenConfig(
            tokenConfig_.asset,
            tokenConfig_.cooldownPeriod,
            tokenConfig_.triggerThreshold,
            tokenConfig_.resetThreshold,
            tokenConfig_.enableBoundedPricing,
            tokenConfig_.enableCaching
        );
    }

    /**
     * @notice Batch-initializes protection for multiple assets in a single transaction
     * @param tokenConfigs_ Array of token config inputs, one per asset
     * @custom:access Only Governance
     * @custom:error InvalidArrayLength if the input array is empty
     * @custom:event ProtectionInitialized for each asset
     * @custom:event BoundedPricingWhitelistUpdated for each asset
     */
    function setTokenConfigs(TokenConfigInput[] calldata tokenConfigs_) external {
        _checkAccessAllowed("setTokenConfigs((address,uint64,uint256,uint256,bool,bool)[])");
        uint256 len = tokenConfigs_.length;
        if (len == 0) revert InvalidArrayLength();

        for (uint256 i; i < len; ++i) {
            TokenConfigInput calldata tokenConfig = tokenConfigs_[i];
            _setTokenConfig(
                tokenConfig.asset,
                tokenConfig.cooldownPeriod,
                tokenConfig.triggerThreshold,
                tokenConfig.resetThreshold,
                tokenConfig.enableBoundedPricing,
                tokenConfig.enableCaching
            );
        }
    }

    /**
     * @notice Sets the cooldown period for an asset
     * @param asset The underlying asset address
     * @param newCooldown The new cooldown period in seconds
     * @custom:access Only Governance
     * @custom:event CooldownPeriodSet
     */
    function setCooldownPeriod(address asset, uint64 newCooldown) external {
        _checkAccessAllowed("setCooldownPeriod(address,uint64)");
        ensureNonzeroAddress(asset);
        ensureNonzeroValue(newCooldown);

        MarketProtectionState storage state = _ensureInitialized(asset);
        emit CooldownPeriodSet(asset, state.cooldownPeriod, newCooldown);
        state.cooldownPeriod = newCooldown;
    }

    /**
     * @notice Sets the trigger and reset thresholds for an asset
     * @param asset The underlying asset address
     * @param newTriggerThreshold The new trigger threshold (mantissa). Must be between 5% and 50% and above the reset threshold.
     * @param newResetThreshold The new reset threshold (mantissa). Must be non-zero and below the trigger threshold.
     * @custom:access Only Governance
     * @custom:error ThresholdBelowMinimum if newTriggerThreshold is below 5%
     * @custom:error ThresholdAboveMaximum if newTriggerThreshold is above 50%
     * @custom:error InvalidResetThreshold if newResetThreshold is at or above newTriggerThreshold
     * @custom:event TriggerThresholdSet if the trigger threshold changed
     * @custom:event ResetThresholdSet if the reset threshold changed
     */
    function setThresholds(address asset, uint256 newTriggerThreshold, uint256 newResetThreshold) external {
        _checkAccessAllowed("setThresholds(address,uint256,uint256)");
        ensureNonzeroAddress(asset);
        ensureNonzeroValue(newTriggerThreshold);
        ensureNonzeroValue(newResetThreshold);
        if (newTriggerThreshold < MIN_THRESHOLD) revert ThresholdBelowMinimum(newTriggerThreshold, MIN_THRESHOLD);
        if (newTriggerThreshold > MAX_THRESHOLD) revert ThresholdAboveMaximum(newTriggerThreshold, MAX_THRESHOLD);
        if (newResetThreshold >= newTriggerThreshold) revert InvalidResetThreshold(newResetThreshold);
        MarketProtectionState storage state = _ensureInitialized(asset);

        if (newTriggerThreshold != state.triggerThreshold) {
            emit TriggerThresholdSet(asset, state.triggerThreshold, newTriggerThreshold);
            state.triggerThreshold = uint128(newTriggerThreshold);
        }
        if (newResetThreshold != state.resetThreshold) {
            emit ResetThresholdSet(asset, state.resetThreshold, newResetThreshold);
            state.resetThreshold = uint128(newResetThreshold);
        }
    }

    /**
     * @notice Sets whether an asset is enabled for bounded pricing
     * @param asset The underlying asset address
     * @param enabled Whether bounded pricing should be enabled for the asset
     * @custom:access Only Governance
     * @custom:error ProtectedPriceActive if trying to disable an asset while protection is active
     * @custom:event BoundedPricingWhitelistUpdated
     */
    function setAssetBoundedPricingEnabled(address asset, bool enabled) external {
        _checkAccessAllowed("setAssetBoundedPricingEnabled(address,bool)");
        ensureNonzeroAddress(asset);

        MarketProtectionState storage state = _ensureInitialized(asset);

        if (!enabled && state.currentlyUsingProtectedPrice) {
            revert ProtectedPriceActive(asset);
        }

        if (state.isBoundedPricingEnabled == enabled) return;

        // reset the window if re-enabling
        if (enabled) {
            uint128 spotU128 = _safeToUint128(_fetchSpotPrice(asset));
            _setMinPrice(state, asset, spotU128);
            _setMaxPrice(state, asset, spotU128);
        }

        state.isBoundedPricingEnabled = enabled;
        emit BoundedPricingWhitelistUpdated(asset, enabled);
    }

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
    function setCachingEnabled(address asset, bool enabled) external {
        _checkAccessAllowed("setCachingEnabled(address,bool)");
        MarketProtectionState storage state = _ensureInitialized(asset);
        emit CachingEnabledUpdated(asset, state.cachingEnabled, enabled);
        state.cachingEnabled = enabled;
    }

    // ----- View helpers -----

    /**
     * @notice Returns all asset addresses that have ever been initialized
     * @return Array of all initialized asset addresses
     */
    function getInitializedAssets() external view returns (address[] memory) {
        return allAssets;
    }

    /**
     * @notice Checks if an asset is whitelisted for bounded pricing
     * @param asset The underlying asset address
     * @return True if the asset is whitelisted
     */
    function isBoundedPricingEnabled(address asset) external view returns (bool) {
        return assetProtectionConfig[asset].isBoundedPricingEnabled;
    }

    /**
     * @notice Checks if the asset is currently using the protected (bounded) price
     * @param asset The underlying asset address
     * @return True if the asset is currently using the protected price instead of spot
     */
    function currentlyUsingProtectedPrice(address asset) external view returns (bool) {
        return assetProtectionConfig[asset].currentlyUsingProtectedPrice;
    }

    /**
     * @notice Returns all currently whitelisted asset addresses
     * @dev Iterates the append-only allAssets array and filters by isBoundedPricingEnabled.
     *      Gas-free for off-chain callers.
     * @return result Array of whitelisted asset addresses
     */
    function getAllBoundedPricingEnabledAssets() external view returns (address[] memory) {
        uint256 len = allAssets.length;
        address[] memory temp = new address[](len);
        uint256 count;
        for (uint256 i; i < len; ++i) {
            if (assetProtectionConfig[allAssets[i]].isBoundedPricingEnabled) {
                temp[count++] = allAssets[i];
            }
        }
        address[] memory result = new address[](count);
        for (uint256 i; i < count; ++i) {
            result[i] = temp[i];
        }
        return result;
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
        MarketProtectionState storage state = assetProtectionConfig[asset];
        return
            state.currentlyUsingProtectedPrice &&
            block.timestamp >= uint256(state.lastProtectionTriggeredAt) + uint256(state.cooldownPeriod) &&
            _computePriceBoundRatio(state.minPrice, state.maxPrice) < state.resetThreshold;
    }

    /**
     * @notice Batch-checks which assets' on-chain min/max have drifted beyond the deadband
     *         from the keeper's proposed window values
     * @dev Allows the keeper to identify stale windows in a single call, avoiding N individual reads.
     *      Drift formula: |onChain - proposed| / onChain (scaled by EXP_SCALE)
     * @param assets Array of asset addresses to check
     * @param proposedMins Keeper's off-chain window minimum prices
     * @param proposedMaxs Keeper's off-chain window maximum prices
     * @return needsMinUpdate Whether minPrice drift exceeds deadband for each asset
     * @return needsMaxUpdate Whether maxPrice drift exceeds deadband for each asset
     * @custom:error InvalidArrayLength if the input array lengths do not match
     */
    function checkAndGetWindowDrift(
        address[] calldata assets,
        uint128[] calldata proposedMins,
        uint128[] calldata proposedMaxs
    ) external view returns (bool[] memory needsMinUpdate, bool[] memory needsMaxUpdate) {
        uint256 len = assets.length;
        if (len != proposedMins.length || len != proposedMaxs.length) revert InvalidArrayLength();

        needsMinUpdate = new bool[](len);
        needsMaxUpdate = new bool[](len);

        for (uint256 i; i < len; ++i) {
            MarketProtectionState storage state = assetProtectionConfig[assets[i]];
            needsMinUpdate[i] = _exceedsCorrectionDeadband(state.minPrice, proposedMins[i]);
            needsMaxUpdate[i] = _exceedsCorrectionDeadband(state.maxPrice, proposedMaxs[i]);
        }
    }

    // ----- Internal functions -----

    /**
     * @notice Initializes protection parameters and price window for a single asset
     * @dev Fetches the current spot price from ResilientOracle to seed the initial min/max window,
     *      confirming the oracle is live for this asset before it is listed. Both bounds start at
     *      spot so the window expands naturally as prices move. Can only be called once per asset.
     * @param asset The underlying asset address
     * @param cooldownPeriod Minimum time protection stays active after last trigger
     * @param triggerThreshold Deviation threshold that activates protection (mantissa). Must be between 5% and 50%.
     * @param resetThreshold Deviation threshold below which protection can be exited (mantissa). Must be non-zero and below triggerThreshold.
     * @param enableBoundedPricing Whether to enable bounded pricing immediately upon initialization
     * @param enableCaching Whether transient caching of the bounded (collateral, debt) pair is enabled for this asset
     * @custom:error ZeroAddressNotAllowed if asset is the zero address
     * @custom:error ZeroValueNotAllowed if cooldownPeriod, triggerThreshold, or resetThreshold is zero
     * @custom:error MarketAlreadyInitialized if the asset has already been initialized
     * @custom:error ThresholdBelowMinimum if triggerThreshold is below 5%
     * @custom:error ThresholdAboveMaximum if triggerThreshold is above 50%
     * @custom:error InvalidResetThreshold if resetThreshold is at or above triggerThreshold
     * @custom:error VAINotAllowed if asset is the VAI token
     * @custom:error PriceExceedsUint128 if the spot price overflows uint128
     */
    function _setTokenConfig(
        address asset,
        uint64 cooldownPeriod,
        uint256 triggerThreshold,
        uint256 resetThreshold,
        bool enableBoundedPricing,
        bool enableCaching
    ) internal {
        ensureNonzeroAddress(asset);
        ensureNonzeroValue(cooldownPeriod);
        ensureNonzeroValue(triggerThreshold);
        ensureNonzeroValue(resetThreshold);
        if (assetProtectionConfig[asset].asset != address(0)) revert MarketAlreadyInitialized(asset);
        if (triggerThreshold < MIN_THRESHOLD) revert ThresholdBelowMinimum(triggerThreshold, MIN_THRESHOLD);
        if (triggerThreshold > MAX_THRESHOLD) revert ThresholdAboveMaximum(triggerThreshold, MAX_THRESHOLD);
        if (resetThreshold >= triggerThreshold) revert InvalidResetThreshold(resetThreshold);
        if (asset == vai) revert VAINotAllowed();

        uint128 spotU128 = _safeToUint128(_fetchSpotPrice(asset));

        assetProtectionConfig[asset] = MarketProtectionState({
            minPrice: spotU128,
            maxPrice: spotU128,
            currentlyUsingProtectedPrice: false,
            isBoundedPricingEnabled: enableBoundedPricing,
            lastProtectionTriggeredAt: 0,
            cooldownPeriod: cooldownPeriod,
            asset: asset,
            triggerThreshold: uint128(triggerThreshold),
            resetThreshold: uint128(resetThreshold),
            cachingEnabled: enableCaching
        });

        allAssets.push(asset);

        emit ProtectionInitialized(asset, spotU128, spotU128, cooldownPeriod, triggerThreshold);
        emit BoundedPricingWhitelistUpdated(asset, enableBoundedPricing);
    }

    /**
     * @notice Validates and applies a keeper-provided min or max price update
     * @param asset The underlying asset address
     * @param newPrice The new price value to set
     * @param boundType Whether this is a MIN or MAX bound update
     * @custom:error ZeroPriceNotAllowed if newPrice is zero
     * @custom:error MarketNotInitialized if the asset has not been initialized
     * @custom:error InvalidMinPrice if boundType is MIN and newPrice exceeds the current spot or is strictly above maxPrice
     * @custom:error InvalidMaxPrice if boundType is MAX and newPrice is below the current spot or is strictly below minPrice
     */
    function _validateAndUpdateBound(address asset, uint128 newPrice, PriceBoundType boundType) internal {
        ensureNonzeroAddress(asset);
        if (newPrice == 0) revert ZeroPriceNotAllowed();
        MarketProtectionState storage state = _ensureInitialized(asset);

        uint256 currentSpot = _fetchSpotPrice(asset);
        if (boundType == PriceBoundType.MIN) {
            if (newPrice > state.maxPrice || uint256(newPrice) > currentSpot)
                revert InvalidMinPrice(asset, newPrice, currentSpot);
            _setMinPrice(state, asset, newPrice);
        } else if (boundType == PriceBoundType.MAX) {
            if (newPrice < state.minPrice || uint256(newPrice) < currentSpot)
                revert InvalidMaxPrice(asset, newPrice, currentSpot);
            _setMaxPrice(state, asset, newPrice);
        }
    }

    /**
     * @notice Clears protection for an asset once cooldown has elapsed and the window has converged
     * @dev Shared body of `exitProtectionMode` and the ExitProtectionMode branch of `syncPriceBoundsAndProtections`.
     *      Callers are responsible for ACM gating before invoking this helper.
     * @param asset The underlying asset address
     * @custom:error MarketNotInitialized if the asset has not been initialized
     * @custom:error ProtectedPriceInactive if protection is not currently active
     * @custom:error CooldownNotElapsed if cooldown period has not elapsed
     * @custom:error PriceRangeNotConverged if the window range is still above the exit threshold
     */
    function _exitProtectionMode(address asset) internal {
        ensureNonzeroAddress(asset);
        MarketProtectionState storage state = _ensureInitialized(asset);

        if (!state.currentlyUsingProtectedPrice) revert ProtectedPriceInactive(asset);

        if (block.timestamp < uint256(state.lastProtectionTriggeredAt) + uint256(state.cooldownPeriod)) {
            revert CooldownNotElapsed(asset, state.lastProtectionTriggeredAt, state.cooldownPeriod);
        }

        uint256 rangeRatio = _computePriceBoundRatio(state.minPrice, state.maxPrice);
        if (rangeRatio >= state.resetThreshold) {
            revert PriceRangeNotConverged(asset, rangeRatio, state.resetThreshold);
        }

        state.currentlyUsingProtectedPrice = false;
        state.lastProtectionTriggeredAt = 0;
        emit ProtectionModeExited(asset);
    }

    /**
     * @notice Shared non-view logic for all bounded price functions.
     *      Fetches spot, updates window, triggers protection if needed, and returns both bounded prices.
     * @param vToken vToken address
     * @return minPrice The bounded lower (collateral) price
     * @return maxPrice The bounded upper (debt) price
     */
    function _updateAndGetBoundedPrices(address vToken) internal returns (uint256 minPrice, uint256 maxPrice) {
        address asset = _getUnderlyingAsset(vToken);

        // Early return if both prices were cached by a prior updateProtectionState call in this tx
        (minPrice, maxPrice) = _getCachedPrices(asset);
        if (minPrice != 0 && maxPrice != 0) return (minPrice, maxPrice);

        // return early if failure from resilient oracle to prevent cold SLOAD
        uint256 spot = _fetchSpotPrice(asset);
        MarketProtectionState storage state = assetProtectionConfig[asset];
        if (!state.isBoundedPricingEnabled) {
            _setCachedPrices(asset, spot, spot);
            return (spot, spot);
        }
        (uint128 updatedMin, uint128 updatedMax, bool windowExpanded) = _expandPriceWindow(state, spot, asset);
        bool protectionActive = _checkAndTriggerProtection(state, spot, asset, windowExpanded);
        (minPrice, maxPrice) = _resolveBoundedPrices(protectionActive, spot, uint256(updatedMin), uint256(updatedMax));
        _setCachedPrices(asset, minPrice, maxPrice);
    }

    /**
     * @dev Expands the price window toward extremes if the spot price is a new min or max
     * @param state The market protection state
     * @param spot The current spot price
     * @param asset The underlying asset address (for event emission)
     */
    function _expandPriceWindow(
        MarketProtectionState storage state,
        uint256 spot,
        address asset
    ) internal returns (uint128, uint128, bool) {
        uint128 spotU128 = _safeToUint128(spot);
        uint128 currentMin = state.minPrice;
        uint128 currentMax = state.maxPrice;
        bool windowExpanded;
        if (spotU128 < currentMin) {
            _setMinPrice(state, asset, spotU128);
            currentMin = spotU128;
            windowExpanded = true;
        }
        if (spotU128 > currentMax) {
            _setMaxPrice(state, asset, spotU128);
            currentMax = spotU128;
            windowExpanded = true;
        }
        return (currentMin, currentMax, windowExpanded);
    }

    /**
     * @dev Checks if the spot price has deviated beyond the threshold and triggers protection.
     *      `lastProtectionTriggeredAt` is reset only on the first trigger or when the price has made a
     *      genuine new extreme this update (windowExpanded == true). Recovery within the existing window
     *      keeps the cooldown ticking so `exitProtectionMode` remains reachable.
     * @param state The market protection state
     * @param spot The current spot price
     * @param asset The underlying asset address (for event emission)
     * @param windowExpanded True if `_expandPriceWindow` recorded a new low or new high this call
     */
    function _checkAndTriggerProtection(
        MarketProtectionState storage state,
        uint256 spot,
        address asset,
        bool windowExpanded
    ) internal returns (bool triggered) {
        if (_exceedsDeviationThreshold(spot, state.minPrice, state.maxPrice, state.triggerThreshold)) {
            bool enteringProtection = !state.currentlyUsingProtectedPrice;
            if (enteringProtection || windowExpanded) {
                state.lastProtectionTriggeredAt = uint64(block.timestamp);
            }
            if (enteringProtection) {
                state.currentlyUsingProtectedPrice = true;
            }
            emit ProtectionTriggered(asset, spot, state.minPrice, state.maxPrice);
            return true;
        }
        if (state.currentlyUsingProtectedPrice) return true;
    }

    /**
     * @notice Resolves the final bounded collateral and debt prices given a spot, window bounds, and protection flag.
     * @dev When protection is active: collateral = min(spot, windowMin), debt = max(spot, windowMax).
     *      When protection is inactive: both return spot.
     * @param protectionActive Whether the market protection window is currently active
     * @param spot The current spot price
     * @param windowMin The lower bound of the price window
     * @param windowMax The upper bound of the price window
     * @return minPrice The resolved lower-bound (collateral) price
     * @return maxPrice The resolved upper-bound (debt) price
     */
    function _resolveBoundedPrices(
        bool protectionActive,
        uint256 spot,
        uint256 windowMin,
        uint256 windowMax
    ) internal pure returns (uint256, uint256) {
        if (!protectionActive) return (spot, spot);
        return (spot < windowMin ? spot : windowMin, spot > windowMax ? spot : windowMax);
    }

    /**
     * @notice Shared view logic for all bounded price view functions.
     *      Checks transient cache first for an early return; on miss, fetches from oracle
     *      and computes both prices without state mutations.
     * @param vToken vToken address
     * @return minPrice The bounded lower (collateral) price
     * @return maxPrice The bounded upper (debt) price
     * @custom:error PriceExceedsUint128 if the spot price overflows uint128 (cache miss path only)
     */
    function _computeBoundedPrices(address vToken) internal view returns (uint256 minPrice, uint256 maxPrice) {
        address asset = _getUnderlyingAsset(vToken);

        // Early return if both prices were cached by a prior updateProtectionState call in this tx
        (minPrice, maxPrice) = _getCachedPrices(asset);
        if (minPrice != 0 && maxPrice != 0) return (minPrice, maxPrice);

        // Cache miss — fetch from oracle and compute without state mutations
        uint256 spot = _fetchSpotPrice(asset);
        MarketProtectionState storage state = assetProtectionConfig[asset];
        if (!state.isBoundedPricingEnabled) return (spot, spot);

        // Mirror _expandPriceWindow logic: compute what the window would be after expansion
        uint128 spotU128 = _safeToUint128(spot);
        uint128 windowMin128 = spot < uint256(state.minPrice) ? spotU128 : state.minPrice;
        uint128 windowMax128 = spot > uint256(state.maxPrice) ? spotU128 : state.maxPrice;

        bool shouldProtect = state.currentlyUsingProtectedPrice ||
            _exceedsDeviationThreshold(spot, windowMin128, windowMax128, state.triggerThreshold);

        (minPrice, maxPrice) = _resolveBoundedPrices(shouldProtect, spot, uint256(windowMin128), uint256(windowMax128));
    }

    /**
     * @dev Computes the relative spread between the price window bounds as a ratio scaled by EXP_SCALE.
     *      Formula: \((maxPrice - minPrice) / minPrice\), scaled by `EXP_SCALE`.
     *      Used to measure how much the window has converged -- compared against `resetThreshold`
     *      to determine whether the price window is tight enough to exit protection mode.
     * @param minPrice The minimum price in the window
     * @param maxPrice The maximum price in the window
     * @return The scaled bound ratio \(((max - min) * EXP_SCALE) / min\)
     */
    function _computePriceBoundRatio(uint128 minPrice, uint128 maxPrice) internal pure returns (uint256) {
        uint256 range = uint256(maxPrice) - uint256(minPrice);
        return (range * EXP_SCALE) / uint256(minPrice);
    }

    /**
     * @notice Checks whether the spot price has moved beyond the threshold relative to the
     *         opposite window bound — i.e. `spot > minPrice * (1 + threshold)` or
     *         `spot < maxPrice * (1 - threshold)`.
     * @dev Pump detection: spot > minPrice * (1 + threshold)
     *      Crash detection: spot < maxPrice * (1 - threshold)
     * @param spot The current spot price
     * @param minPrice The minimum price in the window
     * @param maxPrice The maximum price in the window
     * @param threshold The deviation threshold (mantissa)
     * @return True if deviation is triggered
     */
    function _exceedsDeviationThreshold(
        uint256 spot,
        uint128 minPrice,
        uint128 maxPrice,
        uint256 threshold
    ) internal pure returns (bool) {
        uint256 upperBound = (uint256(minPrice) * (EXP_SCALE + threshold)) / EXP_SCALE;
        uint256 lowerBound = (uint256(maxPrice) * (EXP_SCALE - threshold)) / EXP_SCALE;
        return (spot > upperBound || spot < lowerBound);
    }

    /**
     * @dev Returns true if the relative drift between onChain and proposed exceeds KEEPER_DEADBAND
     * @param currentPrice The current on-chain price
     * @param proposedPrice The keeper's proposed price
     * @return True if drift exceeds deadband
     */
    function _exceedsCorrectionDeadband(uint128 currentPrice, uint128 proposedPrice) internal pure returns (bool) {
        if (currentPrice == 0 || proposedPrice == 0) return false;
        uint256 diff = currentPrice > proposedPrice
            ? uint256(currentPrice - proposedPrice)
            : uint256(proposedPrice - currentPrice);
        return (diff * EXP_SCALE) / uint256(currentPrice) > KEEPER_DEADBAND;
    }

    /**
     * @dev Sets the minimum price in the window and emits MinPriceUpdated
     * @param state The market protection state
     * @param asset The underlying asset address (for event emission)
     * @param newMin The new minimum price
     */
    function _setMinPrice(MarketProtectionState storage state, address asset, uint128 newMin) internal {
        emit MinPriceUpdated(asset, state.minPrice, newMin);
        state.minPrice = newMin;
    }

    /**
     * @dev Sets the maximum price in the window and emits MaxPriceUpdated
     * @param state The market protection state
     * @param asset The underlying asset address (for event emission)
     * @param newMax The new maximum price
     */
    function _setMaxPrice(MarketProtectionState storage state, address asset, uint128 newMax) internal {
        emit MaxPriceUpdated(asset, state.maxPrice, newMax);
        state.maxPrice = newMax;
    }

    /**
     * @dev Writes both lower and upper bounded prices to transient storage. No-ops when the
     *      asset's `cachingEnabled` flag is `false`, so callers that disable caching always
     *      fall through to live recomputation on subsequent reads.
     * @param asset The underlying asset address
     * @param minPrice The resolved lower (collateral) price to cache
     * @param maxPrice The resolved upper (debt) price to cache
     */
    function _setCachedPrices(address asset, uint256 minPrice, uint256 maxPrice) internal {
        if (!assetProtectionConfig[asset].cachingEnabled) return;
        Transient.cachePrice(COLLATERAL_PRICE_CACHE_SLOT, asset, minPrice);
        Transient.cachePrice(DEBT_PRICE_CACHE_SLOT, asset, maxPrice);
    }

    /**
     * @dev Reads a cached final price from transient storage. Returns `(0, 0)` when the
     *      asset's `cachingEnabled` flag is `false`, which callers already treat as a cache
     *      miss and handle via live recomputation.
     * @param asset The underlying asset address
     * @return minPrice The cached minimum price, or 0 on cache miss
     * @return maxPrice The cached maximum price, or 0 on cache miss
     */
    function _getCachedPrices(address asset) internal view returns (uint256 minPrice, uint256 maxPrice) {
        if (!assetProtectionConfig[asset].cachingEnabled) return (0, 0);
        minPrice = Transient.readCachedPrice(COLLATERAL_PRICE_CACHE_SLOT, asset);
        maxPrice = Transient.readCachedPrice(DEBT_PRICE_CACHE_SLOT, asset);
    }

    /**
     * @dev This function returns the underlying asset of a vToken
     * @param vToken vToken address
     * @return asset underlying asset address
     */
    function _getUnderlyingAsset(address vToken) private view returns (address asset) {
        ensureNonzeroAddress(vToken);
        if (vToken == nativeMarket) {
            asset = NATIVE_TOKEN_ADDR;
        } else if (vToken == vai) {
            asset = vai;
        } else {
            asset = VBep20Interface(vToken).underlying();
        }
    }

    /**
     * @dev Reverts if the market has not been initialized via setTokenConfig
     * @param asset The underlying asset address
     * @return state The market protection state storage pointer
     */
    function _ensureInitialized(address asset) internal view returns (MarketProtectionState storage state) {
        state = assetProtectionConfig[asset];
        if (state.asset == address(0)) revert MarketNotInitialized(asset);
    }

    /**
     * @notice Fetches the current spot price for an asset from the ResilientOracle
     * @param asset The underlying asset address
     * @return The current spot price
     */
    function _fetchSpotPrice(address asset) internal view returns (uint256) {
        return RESILIENT_ORACLE.getPrice(asset);
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
