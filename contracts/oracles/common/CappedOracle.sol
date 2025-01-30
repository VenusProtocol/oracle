// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { OracleInterface } from "../../interfaces/OracleInterface.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { CappedOracle } from "./CappedOracle.sol";
import { Transient } from "../../lib/Transient.sol";

/**
 * @title CappedOracle
 * @notice This oracle fetches the price of a correlated token and caps the growth rate
 */
abstract contract CappedOracle is OracleInterface {
    /// Slot to cache the asset's price, used for transient storage
    bytes32 public constant CACHE_SLOT = keccak256(abi.encode("venus-protocol/oracle/common/CappedOracle/cache"));

    //// @notice Growth rate percentage in seconds. Ex: 1e18 is 100%
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint256 public immutable GROWTH_RATE_PER_SECOND;

    /// @notice Snapshot update interval
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint256 public immutable SNAPSHOT_INTERVAL;

    /// @notice Last stored snapshot price
    uint256 public snapshotPrice;

    /// @notice Last stored snapshot timestamp
    uint256 public snapshotTimestamp;

    /// @notice Emitted when the snapshot is updated
    event SnapshotUpdated(uint256 price, uint256 timestamp);

    /**
     * @notice Constructor for the implementation contract.
     * @param annualGrowthRate Annual growth rate in percentage
     * @param snapshotInterval Snapshot update interval. snapshotInterval = 0 means caps are disabled
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(uint256 annualGrowthRate, uint256 snapshotInterval) {
        if (annualGrowthRate == 0 && snapshotInterval > 0) revert("Invalid growth rate");
        SNAPSHOT_INTERVAL = snapshotInterval;
        GROWTH_RATE_PER_SECOND = (annualGrowthRate) / (365 * 24 * 60 * 60);
    }

    /**
     * @notice Returns if the price is capped
     * @return isCapped Boolean indicating if the price is capped
     */
    function isCapped() external view virtual returns (bool) {
        uint256 exchangeRate = _getUnderlyingAmount();
        uint256 maxAllowedExchangeRate = _getMaxAllowedExchangeRate();

        return (exchangeRate > maxAllowedExchangeRate) && (maxAllowedExchangeRate != 0);
    }

    /**
     * @notice Updates the snapshot price and timestamp
     */
    function updateSnapshot() public {
        address asset = token();
        if (Transient.readCachedPrice(CACHE_SLOT, asset) != 0) {
            return;
        }
        if (block.timestamp - snapshotTimestamp < SNAPSHOT_INTERVAL || SNAPSHOT_INTERVAL == 0) return;

        uint256 exchangeRate = _getUnderlyingAmount();
        uint256 maxAllowedExchangeRate = _getMaxAllowedExchangeRate();

        snapshotPrice = exchangeRate > maxAllowedExchangeRate ? maxAllowedExchangeRate : exchangeRate;
        snapshotTimestamp = block.timestamp;
        Transient.cachePrice(CACHE_SLOT, asset, snapshotPrice);
        emit SnapshotUpdated(snapshotPrice, snapshotTimestamp);
    }

    /**
     * @notice Fetches the price of the token
     * @param asset Address of the token
     * @return price The price of the token in scaled decimal places. It can be capped
     * to a maximum value taking into account the growth rate
     */
    function getPrice(address asset) public view override returns (uint256) {
        uint256 price = Transient.readCachedPrice(CACHE_SLOT, asset);
        if (price != 0) {
            return price;
        }

        uint256 exchangeRate = _getUnderlyingAmount();

        if (SNAPSHOT_INTERVAL == 0) {
            return calculatePrice(asset, exchangeRate);
        }

        uint256 maxAllowedExchangeRate = _getMaxAllowedExchangeRate();

        if ((exchangeRate > maxAllowedExchangeRate) && (maxAllowedExchangeRate != 0)) {
            return calculatePrice(asset, maxAllowedExchangeRate);
        } else {
            return calculatePrice(asset, exchangeRate);
        }
    }

    /**
     * @notice Fetches price of the token based on an underlying exchange rate
     * @param asset The address of the asset
     * @param exchangeRate The underlying exchange rate to use
     * @return price The price of the token in scaled decimal places
     */
    function calculatePrice(address asset, uint256 exchangeRate) internal view virtual returns (uint256);

    /**
     * @notice Address of the token
     * @return token The address of the token
     */
    function token() internal view virtual returns (address);

    /**
     * @notice Gets the maximum allowed exchange rate for token
     * @return maxPrice Maximum allowed price
     */
    function _getMaxAllowedExchangeRate() internal view returns (uint256) {
        uint256 timeElapsed = block.timestamp - snapshotTimestamp;
        uint256 maxPrice = snapshotPrice + (snapshotPrice * GROWTH_RATE_PER_SECOND * timeElapsed) / 1e18;
        return maxPrice;
    }

    /**
     * @notice Gets the underlying amount for correlated token
     * @return underlyingAmount Amount of underlying token
     */
    function _getUnderlyingAmount() internal view virtual returns (uint256);
}
