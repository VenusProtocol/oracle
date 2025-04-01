// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { OracleInterface, ResilientOracleInterface } from "../../interfaces/OracleInterface.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ICappedOracle } from "../../interfaces/ICappedOracle.sol";
import { Transient } from "../../lib/Transient.sol";
import "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";

/**
 * @title CorrelatedTokenOracle
 * @notice This oracle fetches the price of a token that is correlated to another token.
 */
abstract contract CorrelatedTokenOracle is OracleInterface, ICappedOracle {
    /// @notice Slot to cache the asset's price, used for transient storage
    /// custom:storage-location erc7201:venus-protocol/oracle/common/CorrelatedTokenOracle/cache
    /// keccak256(abi.encode(uint256(keccak256("venus-protocol/oracle/common/CorrelatedTokenOracle/cache")) - 1))
    ///  & ~bytes32(uint256(0xff))
    bytes32 public constant CACHE_SLOT = 0x285ac4cf3d7b1e95dc20783e633728d23869c1e2c096067904f13d824ae1fb00;

    /// @notice Address of the correlated token
    address public immutable CORRELATED_TOKEN;

    /// @notice Address of the underlying token
    address public immutable UNDERLYING_TOKEN;

    /// @notice Address of Resilient Oracle
    ResilientOracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Address of the AccessControlManager contract
    IAccessControlManagerV8 public ACCESS_CONTROL_MANAGER;

    //// @notice Growth rate percentage in seconds. Ex: 1e18 is 100%
    uint256 public growthRatePerSecond;

    /// @notice Snapshot update interval
    uint256 public snapshotInterval;

    /// @notice Last stored snapshot exchange rate
    uint256 public snapshotExchangeRate;

    /// @notice Last stored snapshot timestamp
    uint256 public snapshotTimestamp;

    /// @notice Gap to add when updating the snapshot
    uint256 public snapshotGap;

    /// @notice Emitted when the snapshot is updated
    event SnapshotUpdated(uint256 indexed exchangeRate, uint256 indexed timestamp);

    /// @notice Emitted when the growth rate is updated
    event GrowthRateUpdated(uint256 indexed annualGrowthRate, uint256 indexed snapshotInterval);

    /// @notice Emitted when the snapshot gap is updated
    event SnapshotGapUpdated(uint256 indexed snapshotGap);

    /// @notice Thrown if the token address is invalid
    error InvalidTokenAddress();

    /// @notice Thrown if the growth rate is invalid
    error InvalidGrowthRate();

    /// @notice Thrown if the initial snapshot is invalid
    error InvalidInitialSnapshot();

    /// @notice Thrown if the snapshot exchange rate is invalid
    error InvalidSnapshotExchangeRate();

    /// @notice @notice Thrown when the action is prohibited by AccessControlManager
    error Unauthorized(address sender, address calledContract, string methodSignature);

    /**
     * @notice Constructor for the implementation contract.
     * @custom:error InvalidGrowthRate error is thrown if the growth rate is invalid
     * @custom:error InvalidInitialSnapshot error is thrown if the initial snapshot values are invalid
     */
    constructor(
        address _correlatedToken,
        address _underlyingToken,
        address _resilientOracle,
        uint256 _annualGrowthRate,
        uint256 _snapshotInterval,
        uint256 _initialSnapshotExchangeRate,
        uint256 _initialSnapshotTimestamp,
        address _accessControlManager,
        uint256 _snapshotGap
    ) {
        growthRatePerSecond = (_annualGrowthRate) / (365 * 24 * 60 * 60);

        if ((growthRatePerSecond == 0 && _snapshotInterval > 0) || (growthRatePerSecond > 0 && _snapshotInterval == 0))
            revert InvalidGrowthRate();

        if ((_initialSnapshotExchangeRate == 0 || _initialSnapshotTimestamp == 0) && snapshotInterval > 0) {
            revert InvalidInitialSnapshot();
        }

        ensureNonzeroAddress(_correlatedToken);
        ensureNonzeroAddress(_underlyingToken);
        ensureNonzeroAddress(_resilientOracle);
        ensureNonzeroAddress(_accessControlManager);

        CORRELATED_TOKEN = _correlatedToken;
        UNDERLYING_TOKEN = _underlyingToken;
        RESILIENT_ORACLE = ResilientOracleInterface(_resilientOracle);
        snapshotInterval = _snapshotInterval;

        snapshotExchangeRate = _initialSnapshotExchangeRate;
        snapshotTimestamp = _initialSnapshotTimestamp;
        snapshotGap = _snapshotGap;

        ACCESS_CONTROL_MANAGER = IAccessControlManagerV8(_accessControlManager);
    }

    /**
     * @notice Directly sets the snapshot exchange rate and timestamp
     * @param _snapshotExchangeRate The exchange rate to set
     * @param _snapshotTimestamp The timestamp to set
     */
    function setSnapshot(uint256 _snapshotExchangeRate, uint256 _snapshotTimestamp) external {
        string memory signature = "setSnapshot(uint256,uint256)";
        bool isAllowedToCall = ACCESS_CONTROL_MANAGER.isAllowedToCall(msg.sender, signature);

        if (!isAllowedToCall) {
            revert Unauthorized(msg.sender, address(this), signature);
        }

        snapshotExchangeRate = _snapshotExchangeRate;
        snapshotTimestamp = _snapshotTimestamp;

        emit SnapshotUpdated(snapshotExchangeRate, snapshotTimestamp);
    }

    /**
     * @notice Sets the growth rate and snapshot interval
     * @param _annualGrowthRate The annual growth rate to set
     * @param _snapshotInterval The snapshot interval to set
     */
    function setGrowthRate(uint256 _annualGrowthRate, uint256 _snapshotInterval) external {
        string memory signature = "setGrowthRate(uint256,uint256)";
        bool isAllowedToCall = ACCESS_CONTROL_MANAGER.isAllowedToCall(msg.sender, signature);

        if (!isAllowedToCall) {
            revert Unauthorized(msg.sender, address(this), signature);
        }

        growthRatePerSecond = (_annualGrowthRate) / (365 * 24 * 60 * 60);

        if ((growthRatePerSecond == 0 && _snapshotInterval > 0) || (growthRatePerSecond > 0 && _snapshotInterval == 0))
            revert InvalidGrowthRate();

        snapshotInterval = _snapshotInterval;

        emit GrowthRateUpdated(_annualGrowthRate, _snapshotInterval);
    }

    /**
     * @notice Sets the snapshot gap
     * @param _snapshotGap The snapshot gap to set
     */
    function setSnapshotGap(uint256 _snapshotGap) external {
        string memory signature = "setSnapshotGap(uint256)";
        bool isAllowedToCall = ACCESS_CONTROL_MANAGER.isAllowedToCall(msg.sender, signature);

        if (!isAllowedToCall) {
            revert Unauthorized(msg.sender, address(this), signature);
        }

        snapshotGap = _snapshotGap;

        emit SnapshotGapUpdated(_snapshotGap);
    }

    /**
     * @notice Returns if the price is capped
     * @return isCapped Boolean indicating if the price is capped
     */
    function isCapped() external view virtual returns (bool) {
        if (snapshotInterval == 0) {
            return false;
        }

        uint256 maxAllowedExchangeRate = getMaxAllowedExchangeRate();
        if (maxAllowedExchangeRate == 0) {
            return false;
        }

        uint256 exchangeRate = getUnderlyingAmount();

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
        if (block.timestamp - snapshotTimestamp < snapshotInterval || snapshotInterval == 0) return;

        uint256 exchangeRate = getUnderlyingAmount();
        uint256 maxAllowedExchangeRate = getMaxAllowedExchangeRate();

        snapshotExchangeRate =
            (exchangeRate > maxAllowedExchangeRate ? maxAllowedExchangeRate : exchangeRate) +
            snapshotGap;
        snapshotTimestamp = block.timestamp;

        if (snapshotExchangeRate == 0) revert InvalidSnapshotExchangeRate();

        RESILIENT_ORACLE.updateAssetPrice(UNDERLYING_TOKEN);
        Transient.cachePrice(CACHE_SLOT, CORRELATED_TOKEN, snapshotExchangeRate);
        emit SnapshotUpdated(snapshotExchangeRate, snapshotTimestamp);
    }

    /**
     * @notice Fetches the price of the token
     * @param asset Address of the token
     * @return price The price of the token in scaled decimal places. It can be capped
     * to a maximum value taking into account the growth rate
     * @custom:error InvalidTokenAddress error is thrown if the token address is invalid
     */
    function getPrice(address asset) public view override returns (uint256) {
        if (asset != CORRELATED_TOKEN) revert InvalidTokenAddress();

        uint256 exchangeRate = Transient.readCachedPrice(CACHE_SLOT, asset);
        if (exchangeRate != 0) {
            return _calculatePrice(exchangeRate);
        }

        exchangeRate = getUnderlyingAmount();

        if (snapshotInterval == 0) {
            return _calculatePrice(exchangeRate);
        }

        uint256 maxAllowedExchangeRate = getMaxAllowedExchangeRate();

        uint256 finalExchangeRate = (exchangeRate > maxAllowedExchangeRate && maxAllowedExchangeRate != 0)
            ? maxAllowedExchangeRate
            : exchangeRate;

        return _calculatePrice(finalExchangeRate);
    }

    /**
     * @notice Gets the maximum allowed exchange rate for token
     * @return maxExchangeRate Maximum allowed exchange rate
     */
    function getMaxAllowedExchangeRate() public view returns (uint256) {
        uint256 timeElapsed = block.timestamp - snapshotTimestamp;
        uint256 maxExchangeRate = snapshotExchangeRate +
            (snapshotExchangeRate * growthRatePerSecond * timeElapsed) /
            1e18;
        return maxExchangeRate;
    }

    /**
     * @notice Gets the underlying amount for correlated token
     * @return underlyingAmount Amount of underlying token
     */
    function getUnderlyingAmount() public view virtual returns (uint256);

    /**
     * @notice Fetches price of the token based on an underlying exchange rate
     * @param exchangeRate The underlying exchange rate to use
     * @return price The price of the token in scaled decimal places
     */
    function _calculatePrice(uint256 exchangeRate) internal view returns (uint256) {
        uint256 underlyingUSDPrice = RESILIENT_ORACLE.getPrice(UNDERLYING_TOKEN);

        IERC20Metadata token = IERC20Metadata(CORRELATED_TOKEN);
        uint256 decimals = token.decimals();

        return (exchangeRate * underlyingUSDPrice) / (10 ** decimals);
    }
}
