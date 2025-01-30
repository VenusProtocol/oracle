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
        uint256 price = getUncappedPrice(token());

        uint256 maxAllowedPrice = _getMaxAllowedPrice();

        return (price > maxAllowedPrice) && (maxAllowedPrice != 0);
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

        snapshotPrice = getPrice(asset);
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

        uint256 uncappedPrice = getUncappedPrice(asset);

        if (SNAPSHOT_INTERVAL == 0) return uncappedPrice;

        uint256 maxAllowedPrice = _getMaxAllowedPrice();

        price = ((uncappedPrice > maxAllowedPrice) && (maxAllowedPrice != 0)) ? maxAllowedPrice : uncappedPrice;

        return price;
    }

    /**
     * @notice Fetches the uncapped price of the token
     * @param asset Address of the token
     * @return price The price of the token in scaled decimal places
     */
    function getUncappedPrice(address asset) internal view virtual returns (uint256);

    /**
     * @notice Address of the token
     * @return token The address of the token
     */
    function token() internal view virtual returns (address);

    /**
     * @notice Gets the maximum allowed price for token
     * @return maxPrice Maximum allowed price
     */
    function _getMaxAllowedPrice() internal view returns (uint256) {
        uint256 timeElapsed = block.timestamp - snapshotTimestamp;
        uint256 maxPrice = snapshotPrice + (snapshotPrice * GROWTH_RATE_PER_SECOND * timeElapsed) / 1e18;
        return maxPrice;
    }
}
