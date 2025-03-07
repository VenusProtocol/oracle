// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { OracleInterface } from "../../interfaces/OracleInterface.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ICappedOracle } from "../../interfaces/ICappedOracle.sol";
import { Transient } from "../../lib/Transient.sol";

/**
 * @title CorrelatedTokenOracle
 * @notice This oracle fetches the price of a token that is correlated to another token.
 */
abstract contract CorrelatedTokenOracle is OracleInterface, ICappedOracle {
    /// @notice Slot to cache the asset's price, used for transient storage
    /// custom:storage-location erc7201:venus-protocol/oracle/common/CorrelatedTokenOracle/cache
    /// keccak256(abi.encode(uint256(keccak256("venus-protocol/oracle/common/CorrelatedTokenOracle/cache")) - 1))
    ///  & ~bytes32(uint256(0xff)
    bytes32 public constant CACHE_SLOT = 0x285ac4cf3d7b1e95dc20783e633728d23869c1e2c096067904f13d824ae1fb00;

    /// @notice Address of the correlated token
    address public immutable CORRELATED_TOKEN;

    /// @notice Address of the underlying token
    address public immutable UNDERLYING_TOKEN;

    //// @notice Growth rate percentage in seconds. Ex: 1e18 is 100%
    uint256 public immutable GROWTH_RATE_PER_SECOND;

    /// @notice Snapshot update interval
    uint256 public immutable SNAPSHOT_INTERVAL;

    /// @notice Address of Resilient Oracle
    OracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Last stored snapshot exchange rate
    uint256 public snapshotExchangeRate;

    /// @notice Last stored snapshot timestamp
    uint256 public snapshotTimestamp;

    /// @notice Emitted when the snapshot is updated
    event SnapshotUpdated(uint256 exchangeRate, uint256 timestamp);

    /// @notice Thrown if the token address is invalid
    error InvalidTokenAddress();

    /// @notice Thrown if the growth rate is invalid
    error InvalidGrowthRate();

    /// @notice Thrown if the initial snapshot is invalid
    error InvalidInitialSnapshot();

    /// @notice Thrown if the snapshot exchange rate is invalid
    error InvalidSnapshotExchangeRate();

    /**
     * @notice Constructor for the implementation contract.
     * @custom:error InvalidGrowthRate error is thrown if the growth rate is invalid
     * @custom:error InvalidInitialSnapshot error is thrown if the initial snapshot values are invalid
     */
    constructor(
        address correlatedToken,
        address underlyingToken,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 snapshotInterval,
        uint256 initialSnapshotExchangeRate,
        uint256 initialSnapshotTimestamp
    ) {
        GROWTH_RATE_PER_SECOND = (annualGrowthRate) / (365 * 24 * 60 * 60);

        if (
            (GROWTH_RATE_PER_SECOND == 0 && snapshotInterval > 0) ||
            (GROWTH_RATE_PER_SECOND > 0 && snapshotInterval == 0)
        ) revert InvalidGrowthRate();

        if ((initialSnapshotExchangeRate == 0 || initialSnapshotTimestamp == 0) && snapshotInterval > 0) {
            revert InvalidInitialSnapshot();
        }

        ensureNonzeroAddress(correlatedToken);
        ensureNonzeroAddress(underlyingToken);
        ensureNonzeroAddress(resilientOracle);

        CORRELATED_TOKEN = correlatedToken;
        UNDERLYING_TOKEN = underlyingToken;
        RESILIENT_ORACLE = OracleInterface(resilientOracle);
        SNAPSHOT_INTERVAL = snapshotInterval;

        snapshotExchangeRate = initialSnapshotExchangeRate;
        snapshotTimestamp = initialSnapshotTimestamp;
    }

    /**
     * @notice Returns if the price is capped
     * @return isCapped Boolean indicating if the price is capped
     */
    function isCapped() external view virtual returns (bool) {
        if (SNAPSHOT_INTERVAL == 0) {
            return false;
        }

        uint256 maxAllowedExchangeRate = _getMaxAllowedExchangeRate();
        if (maxAllowedExchangeRate == 0) {
            return false;
        }

        uint256 exchangeRate = _getUnderlyingAmount();

        return exchangeRate > maxAllowedExchangeRate;
    }

    /**
     * @notice Updates the snapshot price and timestamp
     * @custom:event Emits SnapshotUpdated event on successful update of the snapshot
     */
    function updateSnapshot() public override {
        if (Transient.readCachedPrice(CACHE_SLOT, CORRELATED_TOKEN) != 0) {
            return;
        }
        if (block.timestamp - snapshotTimestamp < SNAPSHOT_INTERVAL || SNAPSHOT_INTERVAL == 0) return;

        uint256 exchangeRate = _getUnderlyingAmount();
        uint256 maxAllowedExchangeRate = _getMaxAllowedExchangeRate();

        snapshotExchangeRate = exchangeRate > maxAllowedExchangeRate ? maxAllowedExchangeRate : exchangeRate;
        snapshotTimestamp = block.timestamp;

        if (snapshotExchangeRate == 0) revert InvalidSnapshotExchangeRate();

        Transient.cachePrice(CACHE_SLOT, CORRELATED_TOKEN, snapshotExchangeRate);
        emit SnapshotUpdated(snapshotExchangeRate, snapshotTimestamp);
    }

    /**
     * @notice Fetches the price of the token
     * @param asset Address of the token
     * @return price The price of the token in scaled decimal places. It can be capped
     * to a maximum value taking into account the growth rate
     */
    function getPrice(address asset) public view override returns (uint256) {
        uint256 exchangeRate = Transient.readCachedPrice(CACHE_SLOT, asset);
        if (exchangeRate != 0) {
            return _calculatePrice(asset, exchangeRate);
        }

        exchangeRate = _getUnderlyingAmount();

        if (SNAPSHOT_INTERVAL == 0) {
            return _calculatePrice(asset, exchangeRate);
        }

        uint256 maxAllowedExchangeRate = _getMaxAllowedExchangeRate();

        uint256 finalExchangeRate = (exchangeRate > maxAllowedExchangeRate && maxAllowedExchangeRate != 0)
            ? maxAllowedExchangeRate
            : exchangeRate;

        return _calculatePrice(asset, finalExchangeRate);
    }

    /**
     * @notice Fetches price of the token based on an underlying exchange rate
     * @param asset The address of the asset
     * @param exchangeRate The underlying exchange rate to use
     * @return price The price of the token in scaled decimal places
     * @custom:error InvalidTokenAddress error is thrown if the token address is invalid
     */
    function _calculatePrice(address asset, uint256 exchangeRate) internal view returns (uint256) {
        if (asset != CORRELATED_TOKEN) revert InvalidTokenAddress();

        uint256 underlyingUSDPrice = RESILIENT_ORACLE.getPrice(UNDERLYING_TOKEN);

        IERC20Metadata token = IERC20Metadata(CORRELATED_TOKEN);
        uint256 decimals = token.decimals();

        return (exchangeRate * underlyingUSDPrice) / (10 ** decimals);
    }

    /**
     * @notice Gets the maximum allowed exchange rate for token
     * @return maxExchangeRate Maximum allowed exchange rate
     */
    function _getMaxAllowedExchangeRate() internal view returns (uint256) {
        uint256 timeElapsed = block.timestamp - snapshotTimestamp;
        uint256 maxExchangeRate = snapshotExchangeRate +
            (snapshotExchangeRate * GROWTH_RATE_PER_SECOND * timeElapsed) /
            1e18;
        return maxExchangeRate;
    }

    /**
     * @notice Gets the underlying amount for correlated token
     * @return underlyingAmount Amount of underlying token
     */
    function _getUnderlyingAmount() internal view virtual returns (uint256);
}
