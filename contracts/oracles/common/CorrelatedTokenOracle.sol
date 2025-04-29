// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { OracleInterface, ResilientOracleInterface } from "../../interfaces/OracleInterface.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { SECONDS_PER_YEAR } from "@venusprotocol/solidity-utilities/contracts/constants.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ICappedOracle } from "../../interfaces/ICappedOracle.sol";
import "@venusprotocol/governance-contracts/contracts/Governance/IAccessControlManagerV8.sol";

/**
 * @title CorrelatedTokenOracle
 * @notice This oracle fetches the price of a token that is correlated to another token.
 */
abstract contract CorrelatedTokenOracle is OracleInterface, ICappedOracle {
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
    uint256 public snapshotMaxExchangeRate;

    /// @notice Last stored snapshot timestamp
    uint256 public snapshotTimestamp;

    /// @notice Gap to add when updating the snapshot
    uint256 public snapshotGap;

    /// @notice Emitted when the snapshot is updated
    event SnapshotUpdated(uint256 indexed exchangeRate, uint256 indexed timestamp);

    /// @notice Emitted when the growth rate is updated
    event GrowthRateUpdated(
        uint256 indexed oldGrowthRatePerSecond,
        uint256 indexed newGrowthRatePerSecond,
        uint256 indexed oldSnapshotInterval,
        uint256 newSnapshotInterval
    );

    /// @notice Emitted when the snapshot gap is updated
    event SnapshotGapUpdated(uint256 indexed oldSnapshotGap, uint256 indexed newSnapshotGap);

    /// @notice Thrown if the token address is invalid
    error InvalidTokenAddress();

    /// @notice Thrown if the growth rate is invalid
    error InvalidGrowthRate();

    /// @notice Thrown if the initial snapshot is invalid
    error InvalidInitialSnapshot();

    /// @notice Thrown if the snapshot exchange rate is invalid
    error InvalidSnapshotMaxExchangeRate();

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
        uint256 _initialSnapshotMaxExchangeRate,
        uint256 _initialSnapshotTimestamp,
        address _accessControlManager,
        uint256 _snapshotGap
    ) {
        growthRatePerSecond = _annualGrowthRate / SECONDS_PER_YEAR;

        if ((growthRatePerSecond == 0 && _snapshotInterval > 0) || (growthRatePerSecond > 0 && _snapshotInterval == 0))
            revert InvalidGrowthRate();

        if ((_initialSnapshotMaxExchangeRate == 0 || _initialSnapshotTimestamp == 0) && _snapshotInterval > 0) {
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

        snapshotMaxExchangeRate = _initialSnapshotMaxExchangeRate;
        snapshotTimestamp = _initialSnapshotTimestamp;
        snapshotGap = _snapshotGap;

        ACCESS_CONTROL_MANAGER = IAccessControlManagerV8(_accessControlManager);
    }

    /**
     * @notice Directly sets the snapshot exchange rate and timestamp
     * @param _snapshotMaxExchangeRate The exchange rate to set
     * @param _snapshotTimestamp The timestamp to set
     */
    function setSnapshot(uint256 _snapshotMaxExchangeRate, uint256 _snapshotTimestamp) external {
        _checkAccessAllowed("setSnapshot(uint256,uint256)");

        snapshotMaxExchangeRate = _snapshotMaxExchangeRate;
        snapshotTimestamp = _snapshotTimestamp;

        emit SnapshotUpdated(snapshotMaxExchangeRate, snapshotTimestamp);
    }

    /**
     * @notice Sets the growth rate and snapshot interval
     * @param _annualGrowthRate The annual growth rate to set
     * @param _snapshotInterval The snapshot interval to set
     */
    function setGrowthRate(uint256 _annualGrowthRate, uint256 _snapshotInterval) external {
        _checkAccessAllowed("setGrowthRate(uint256,uint256)");
        uint256 oldGrowthRatePerSecond = growthRatePerSecond;

        growthRatePerSecond = _annualGrowthRate / SECONDS_PER_YEAR;

        if ((growthRatePerSecond == 0 && _snapshotInterval > 0) || (growthRatePerSecond > 0 && _snapshotInterval == 0))
            revert InvalidGrowthRate();

        emit GrowthRateUpdated(oldGrowthRatePerSecond, growthRatePerSecond, snapshotInterval, _snapshotInterval);

        snapshotInterval = _snapshotInterval;
    }

    /**
     * @notice Sets the snapshot gap
     * @param _snapshotGap The snapshot gap to set
     */
    function setSnapshotGap(uint256 _snapshotGap) external {
        _checkAccessAllowed("setSnapshotGap(uint256)");

        emit SnapshotGapUpdated(snapshotGap, _snapshotGap);

        snapshotGap = _snapshotGap;
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
        if (block.timestamp - snapshotTimestamp < snapshotInterval || snapshotInterval == 0) return;

        uint256 exchangeRate = getUnderlyingAmount();
        uint256 maxAllowedExchangeRate = getMaxAllowedExchangeRate();

        snapshotMaxExchangeRate =
            (exchangeRate > maxAllowedExchangeRate ? maxAllowedExchangeRate : exchangeRate) +
            snapshotGap;
        snapshotTimestamp = block.timestamp;

        if (snapshotMaxExchangeRate == 0) revert InvalidSnapshotMaxExchangeRate();

        RESILIENT_ORACLE.updateAssetPrice(UNDERLYING_TOKEN);
        emit SnapshotUpdated(snapshotMaxExchangeRate, snapshotTimestamp);
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

        uint256 exchangeRate = getUnderlyingAmount();

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
        uint256 maxExchangeRate = snapshotMaxExchangeRate +
            (snapshotMaxExchangeRate * growthRatePerSecond * timeElapsed) /
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

    /**
     * @notice Reverts if the call is not allowed by AccessControlManager
     * @param signature Method signature
     */
    function _checkAccessAllowed(string memory signature) internal view {
        bool isAllowedToCall = ACCESS_CONTROL_MANAGER.isAllowedToCall(msg.sender, signature);

        if (!isAllowedToCall) {
            revert Unauthorized(msg.sender, address(this), signature);
        }
    }
}
