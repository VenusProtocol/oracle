// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { IAccessControlManagerV8 } from "@venusprotocol/governance-contracts/contracts/Governance/IAccessControlManagerV8.sol";

/**
 * @title PriceCircuitBreaker
 * @author Venus
 * @notice Oracle wrapper that trips a circuit breaker when an asset's price drops
 * beyond a configurable threshold within a time window. This prevents lending protocols
 * from accepting collateral at stale high prices during rapid price crashes on
 * low-liquidity tokens (e.g. THE/Thena attack, March 2026).
 *
 * When the circuit breaker trips, getPrice() reverts, effectively pausing the
 * market for that asset until governance resets it.
 *
 * @dev Deploy as the main oracle in ResilientOracle's token config, wrapping
 * the actual price source (e.g. Chainlink).
 */
contract PriceCircuitBreaker is OracleInterface {
    struct AssetConfig {
        /// @notice Maximum allowed price drop in basis points (e.g. 3000 = 30%)
        uint256 maxDropBps;
        /// @notice Time window in seconds over which the drop is measured
        uint256 windowSeconds;
        /// @notice Last recorded price (scaled 1e18)
        uint256 lastPrice;
        /// @notice Timestamp of last recorded price
        uint256 lastTimestamp;
        /// @notice Whether the circuit breaker has tripped
        bool tripped;
    }

    /// @notice The underlying oracle to fetch prices from
    OracleInterface public immutable UNDERLYING_ORACLE;

    /// @notice Access control manager
    IAccessControlManagerV8 public immutable ACCESS_CONTROL_MANAGER;

    /// @notice Circuit breaker config per asset
    mapping(address => AssetConfig) public assetConfigs;

    /// @notice Default max drop: 30% in basis points
    uint256 public constant DEFAULT_MAX_DROP_BPS = 3000;

    /// @notice Default window: 1 hour
    uint256 public constant DEFAULT_WINDOW_SECONDS = 3600;

    event CircuitBreakerTripped(address indexed asset, uint256 previousPrice, uint256 currentPrice, uint256 dropBps);
    event CircuitBreakerReset(address indexed asset);
    event AssetConfigSet(address indexed asset, uint256 maxDropBps, uint256 windowSeconds);

    error CircuitBreakerActive(address asset);
    error Unauthorized(address sender, address calledContract, string methodSignature);

    constructor(address _underlyingOracle, address _accessControlManager) {
        UNDERLYING_ORACLE = OracleInterface(_underlyingOracle);
        ACCESS_CONTROL_MANAGER = IAccessControlManagerV8(_accessControlManager);
    }

    /**
     * @notice Configure circuit breaker parameters for an asset
     * @param asset The asset address
     * @param maxDropBps Maximum allowed price drop in basis points
     * @param windowSeconds Time window for measuring price drops
     */
    function setAssetConfig(address asset, uint256 maxDropBps, uint256 windowSeconds) external {
        _checkAccessAllowed("setAssetConfig(address,uint256,uint256)");
        assetConfigs[asset].maxDropBps = maxDropBps;
        assetConfigs[asset].windowSeconds = windowSeconds;
        emit AssetConfigSet(asset, maxDropBps, windowSeconds);
    }

    /**
     * @notice Reset a tripped circuit breaker (governance only)
     * @param asset The asset to reset
     */
    function resetCircuitBreaker(address asset) external {
        _checkAccessAllowed("resetCircuitBreaker(address)");
        assetConfigs[asset].tripped = false;
        assetConfigs[asset].lastPrice = 0;
        assetConfigs[asset].lastTimestamp = 0;
        emit CircuitBreakerReset(asset);
    }

    /**
     * @notice Get price with circuit breaker protection
     * @param asset Asset address
     * @return price The price if circuit breaker has not tripped
     */
    function getPrice(address asset) external view override returns (uint256) {
        AssetConfig storage config = assetConfigs[asset];

        // If circuit breaker has tripped, revert
        if (config.tripped) revert CircuitBreakerActive(asset);

        // Fetch price from underlying oracle
        uint256 currentPrice = UNDERLYING_ORACLE.getPrice(asset);

        // If no previous price recorded, return current price
        if (config.lastPrice == 0) {
            return currentPrice;
        }

        // Check if price has dropped beyond threshold within the time window
        uint256 maxDrop = config.maxDropBps > 0 ? config.maxDropBps : DEFAULT_MAX_DROP_BPS;
        uint256 window = config.windowSeconds > 0 ? config.windowSeconds : DEFAULT_WINDOW_SECONDS;

        if (block.timestamp - config.lastTimestamp <= window && currentPrice < config.lastPrice) {
            uint256 dropBps = ((config.lastPrice - currentPrice) * 10000) / config.lastPrice;
            if (dropBps >= maxDrop) {
                // In a view function we can't write state, but we can revert
                revert CircuitBreakerActive(asset);
            }
        }

        return currentPrice;
    }

    /**
     * @notice Record the current price snapshot. Should be called periodically.
     * @param asset Asset address
     */
    function updatePriceSnapshot(address asset) external {
        AssetConfig storage config = assetConfigs[asset];
        if (config.tripped) revert CircuitBreakerActive(asset);

        uint256 currentPrice = UNDERLYING_ORACLE.getPrice(asset);

        // Check for circuit breaker trip before updating
        if (config.lastPrice > 0) {
            uint256 maxDrop = config.maxDropBps > 0 ? config.maxDropBps : DEFAULT_MAX_DROP_BPS;
            uint256 window = config.windowSeconds > 0 ? config.windowSeconds : DEFAULT_WINDOW_SECONDS;

            if (block.timestamp - config.lastTimestamp <= window && currentPrice < config.lastPrice) {
                uint256 dropBps = ((config.lastPrice - currentPrice) * 10000) / config.lastPrice;
                if (dropBps >= maxDrop) {
                    config.tripped = true;
                    emit CircuitBreakerTripped(asset, config.lastPrice, currentPrice, dropBps);
                    return;
                }
            }
        }

        config.lastPrice = currentPrice;
        config.lastTimestamp = block.timestamp;
    }

    function _checkAccessAllowed(string memory signature) internal view {
        if (!ACCESS_CONTROL_MANAGER.isAllowedToCall(msg.sender, signature)) {
            revert Unauthorized(msg.sender, address(this), signature);
        }
    }
}
