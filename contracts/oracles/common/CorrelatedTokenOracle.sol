// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { OracleInterface } from "../../interfaces/OracleInterface.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title CorrelatedTokenOracle
 * @notice This oracle fetches the price of a token that is correlated to another token.
 */
abstract contract CorrelatedTokenOracle is OracleInterface {
    /// @notice Address of the correlated token
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable CORRELATED_TOKEN;

    /// @notice Address of the underlying token
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable UNDERLYING_TOKEN;

    /// @notice Address of Resilient Oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    OracleInterface public immutable RESILIENT_ORACLE;

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

    /// @notice Thrown if the token address is invalid
    error InvalidTokenAddress();

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address correlatedToken,
        address underlyingToken,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 snapshotInterval
    ) {
        ensureNonzeroAddress(correlatedToken);
        ensureNonzeroAddress(underlyingToken);
        ensureNonzeroAddress(resilientOracle);
        ensureNonzeroValue(snapshotInterval);

        CORRELATED_TOKEN = correlatedToken;
        UNDERLYING_TOKEN = underlyingToken;
        RESILIENT_ORACLE = OracleInterface(resilientOracle);

        SNAPSHOT_INTERVAL = snapshotInterval;
        GROWTH_RATE_PER_SECOND = (annualGrowthRate) / (365 * 24 * 60 * 60);
    }

    /**
     * @notice Updates the snapshot price and timestamp
     */
    function updateSnapshot() public {
        if (block.timestamp - snapshotTimestamp < SNAPSHOT_INTERVAL) return;

        snapshotPrice = getPrice(CORRELATED_TOKEN);
        snapshotTimestamp = block.timestamp;
        emit SnapshotUpdated(snapshotPrice, snapshotTimestamp);
    }

    /**
     * @notice Fetches the price of the correlated token
     * @param asset Address of the correlated token
     * @return price The price of the correlated token in scaled decimal places
     */
    function getPrice(address asset) public view override returns (uint256) {
        if (asset != CORRELATED_TOKEN) revert InvalidTokenAddress();

        // get underlying token amount for 1 correlated token scaled by underlying token decimals
        uint256 underlyingAmount = _getUnderlyingAmount();

        // oracle returns (36 - asset decimal) scaled price
        uint256 underlyingUSDPrice = RESILIENT_ORACLE.getPrice(UNDERLYING_TOKEN);

        IERC20Metadata token = IERC20Metadata(CORRELATED_TOKEN);
        uint256 decimals = token.decimals();

        // underlyingAmount (for 1 correlated token) * underlyingUSDPrice / decimals(correlated token)
        uint256 price = (underlyingAmount * underlyingUSDPrice) / (10 ** decimals);
        uint256 maxAllowedPrice = _getMaxAllowedPrice();

        return ((price > maxAllowedPrice) && (maxAllowedPrice != 0)) ? maxAllowedPrice : price;
    }

    /**
     * @notice Gets the maximum allowed price for correlated token
     * @return maxPrice Maximum allowed price
     */
    function _getMaxAllowedPrice() internal view returns (uint256) {
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
