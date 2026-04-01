// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

interface IDeviationBoundedOracle {
    // --- Non-view price functions (update window + trigger protection) ---

    function getBoundedCollateralPrice(address vToken) external returns (uint256);

    function getBoundedDebtPrice(address vToken) external returns (uint256);

    // --- View price functions (read stored/cached state only) ---

    function getBoundedCollateralPriceView(address vToken) external view returns (uint256);

    function getBoundedDebtPriceView(address vToken) external view returns (uint256);

    // --- State update (called before view price reads to populate transient cache) ---

    function updateProtectionState(address vToken) external;

    // --- Keeper functions ---

    function updateMinPrice(address asset, uint128 newMin) external;

    function updateMaxPrice(address asset, uint128 newMax) external;

    function disableProtection(address asset) external;

    // --- Admin functions (governance-gated) ---

    function initializeProtection(
        address asset,
        uint128 minPrice,
        uint128 maxPrice,
        uint64 cooldownPeriod,
        uint256 threshold
    ) external;

    function setCooldownPeriod(address asset, uint64 cooldown) external;

    function setThreshold(address asset, uint256 threshold) external;

    function setExitThreshold(address asset, uint256 exitThreshold) external;

    function setWhitelisted(address asset, bool whitelisted) external;

    // --- View helpers ---

    function isWhitelisted(address asset) external view returns (bool);

    function isProtected(address asset) external view returns (bool);

    function canExitProtection(address asset) external view returns (bool);

    function marketProtection(
        address asset
    )
        external
        view
        returns (
            uint128 minPrice,
            uint128 maxPrice,
            bool protectedPriceEnabled,
            bool isWhitelisted,
            uint64 protectionEnabledAt,
            uint64 cooldownPeriod
        );

    function thresholds(address asset) external view returns (uint256);

    function exitThresholds(address asset) external view returns (uint256);

    function getWhitelistedAssets() external view returns (address[] memory);

    function checkWindowDrift(
        address[] calldata assets,
        uint128[] calldata proposedMins,
        uint128[] calldata proposedMaxs
    ) external view returns (bool[] memory needsMinUpdate, bool[] memory needsMaxUpdate);
}
