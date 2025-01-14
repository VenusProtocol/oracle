// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { OracleInterface } from "../../interfaces/OracleInterface.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title CappedOracle
 * @notice This oracle fetches the price of a correlated token and caps the growth rate
 */
abstract contract CappedOracle {
    /// @notice Address of the correlated token
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable CORRELATED_TOKEN;

    //// @notice Growth rate percentage in seconds. Ex: 1e18 is 100%
    uint256 public immutable GROWTH_RATE_PER_SECOND;

    /// @notice Snapshot update interval
    uint256 public immutable SNAPSHOT_INTERVAL;

    /// @notice Last stored snapshot price
    uint256 public snapshotPrice;

    /// @notice Last stored snapshot timestamp
    uint256 public snapshotTimestamp;

    /// @notice Emitted when the snapshot is updated
    event SnapshotUpdated(uint256 price, uint256 timestamp);

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address correlatedToken, uint256 annualGrowthRate, uint256 snapshotInterval) {
        ensureNonzeroAddress(correlatedToken);

        CORRELATED_TOKEN = correlatedToken;

        SNAPSHOT_INTERVAL = snapshotInterval;
        GROWTH_RATE_PER_SECOND = (annualGrowthRate) / (365 * 24 * 60 * 60);
    }

    /**
     * @notice Returns if the price is capped
     * @return isCapped Boolean indicating if the price is capped
     */
    function isCapped() external view virtual returns (bool);

    /**
     * @notice Updates the snapshot price and timestamp
     */
    function updateSnapshot() public {
        if (block.timestamp - snapshotTimestamp < SNAPSHOT_INTERVAL || SNAPSHOT_INTERVAL == 0) return;

        snapshotPrice = getPrice(CORRELATED_TOKEN);
        snapshotTimestamp = block.timestamp;
        emit SnapshotUpdated(snapshotPrice, snapshotTimestamp);
    }

    /**
     * @notice Fetches the price of the correlated token
     * @param asset Address of the correlated token
     * @return price The price of the correlated token in scaled decimal places
     */
    function getPrice(address asset) public view virtual returns (uint256);

    /**
     * @notice Fetches the uncapped price of the correlated token
     * @param asset Address of the correlated token
     * @return price The price of the correlated token in scaled decimal places
     */
    function getUncappedPrice(address asset) internal view virtual returns (uint256);

    /**
     * @notice Gets the maximum allowed price for correlated token
     * @return maxPrice Maximum allowed price
     */
    function _getMaxAllowedPrice() internal view returns (uint256) {
        uint256 timeElapsed = block.timestamp - snapshotTimestamp;
        uint256 maxPrice = snapshotPrice + (snapshotPrice * GROWTH_RATE_PER_SECOND * timeElapsed) / 1e18;
        return maxPrice;
    }
}
