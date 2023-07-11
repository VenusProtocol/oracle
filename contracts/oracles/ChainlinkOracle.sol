// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "../interfaces/VBep20Interface.sol";
import "../interfaces/OracleInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";

/**
 * @title ChainlinkOracle
 * @author Venus
 * @notice This oracle fetches prices of assets from the Chainlink oracle.
 */
contract ChainlinkOracle is AccessControlledV8, OracleInterface {
    struct TokenConfig {
        /// @notice Underlying token address, which can't be a null address
        /// @notice Used to check if a token is supported
        /// @notice 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB for BNB
        address asset;
        /// @notice Chainlink feed address
        address feed;
        /// @notice Price expiration period of this asset
        uint256 maxStalePeriod;
    }

    /// @notice Set this as asset address for BNB. This is the underlying address for vBNB
    address public constant BNB_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice Manually set an override price, useful under extenuating conditions such as price feed failure
    mapping(address => uint256) public prices;

    /// @notice Token config by assets
    mapping(address => TokenConfig) public tokenConfigs;

    /// @notice Emit when a price is manually set
    event PricePosted(address indexed asset, uint256 previousPriceMantissa, uint256 newPriceMantissa);

    /// @notice Emit when a token config is added
    event TokenConfigAdded(address indexed asset, address feed, uint256 maxStalePeriod);

    modifier notNullAddress(address someone) {
        if (someone == address(0)) revert("can't be zero address");
        _;
    }

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Manually set the price of a given asset
     * @param asset Asset address
     * @param price Asset price in 18 decimals
     * @custom:access Only Governance
     * @custom:event Emits PricePosted event on succesfully setup of asset price
     */
    function setDirectPrice(address asset, uint256 price) external notNullAddress(asset) {
        _checkAccessAllowed("setDirectPrice(address,uint256)");

        uint256 previousPriceMantissa = prices[asset];
        prices[asset] = price;
        emit PricePosted(asset, previousPriceMantissa, price);
    }

    /**
     * @notice Add multiple token configs at the same time
     * @param tokenConfigs_ config array
     * @custom:access Only Governance
     * @custom:error Zero length error thrown, if length of the array in parameter is 0
     */
    function setTokenConfigs(TokenConfig[] memory tokenConfigs_) external {
        if (tokenConfigs_.length == 0) revert("length can't be 0");
        uint256 numTokenConfigs = tokenConfigs_.length;
        for (uint256 i; i < numTokenConfigs; ) {
            setTokenConfig(tokenConfigs_[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Initializes the owner of the contract
     * @param accessControlManager_ Address of the access control manager contract
     */
    function initialize(address accessControlManager_) external initializer {
        __AccessControlled_init(accessControlManager_);
    }

    /**
     * @notice Add single token config. asset & feed cannot be null addresses and maxStalePeriod must be positive
     * @param tokenConfig Token config struct
     * @custom:access Only Governance
     * @custom:error NotNullAddress error is thrown if asset address is null
     * @custom:error NotNullAddress error is thrown if token feed address is null
     * @custom:error Range error is thrown if maxStale period of token is not greater than zero
     * @custom:event Emits TokenConfigAdded event on succesfully setting of the token config
     */
    function setTokenConfig(
        TokenConfig memory tokenConfig
    ) public notNullAddress(tokenConfig.asset) notNullAddress(tokenConfig.feed) {
        _checkAccessAllowed("setTokenConfig(TokenConfig)");

        if (tokenConfig.maxStalePeriod == 0) revert("stale period can't be zero");
        tokenConfigs[tokenConfig.asset] = tokenConfig;
        emit TokenConfigAdded(tokenConfig.asset, tokenConfig.feed, tokenConfig.maxStalePeriod);
    }

    /**
     * @notice Gets the price of a asset from the chainlink oracle
     * @param asset Address of the asset
     * @return Price in USD from Chainlink or a manually set price for the asset
     */
    function getPrice(address asset) public view returns (uint256) {
        uint256 decimals;

        if (asset == BNB_ADDR) {
            decimals = 18;
        } else {
            IERC20Metadata token = IERC20Metadata(asset);
            decimals = token.decimals();
        }

        return _getPriceInternal(asset, decimals);
    }

    /**
     * @notice Gets the Chainlink price for a given asset
     * @param asset address of the asset
     * @param decimals decimals of the asset
     * @return price Asset price in USD or a manually set price of the asset
     */
    function _getPriceInternal(address asset, uint256 decimals) internal view returns (uint256 price) {
        uint256 tokenPrice = prices[asset];
        if (tokenPrice != 0) {
            price = tokenPrice;
        } else {
            price = _getChainlinkPrice(asset);
        }

        uint256 decimalDelta = 18 - decimals;
        return price * (10 ** decimalDelta);
    }

    /**
     * @notice Get the Chainlink price for an asset, revert if token config doesn't exist
     * @dev The precision of the price feed is used to ensure the returned price has 18 decimals of precision
     * @param asset Address of the asset
     * @return price Price in USD, with 18 decimals of precision
     * @custom:error NotNullAddress error is thrown if the asset address is null
     * @custom:error Price error is thrown if the Chainlink price of asset is not greater than zero
     * @custom:error Timing error is thrown if current timestamp is less than the last updatedAt timestamp
     * @custom:error Timing error is thrown if time difference between current time and last updated time
     * is greater than maxStalePeriod
     */
    function _getChainlinkPrice(
        address asset
    ) private view notNullAddress(tokenConfigs[asset].asset) returns (uint256) {
        TokenConfig memory tokenConfig = tokenConfigs[asset];
        AggregatorV3Interface feed = AggregatorV3Interface(tokenConfig.feed);

        // note: maxStalePeriod cannot be 0
        uint256 maxStalePeriod = tokenConfig.maxStalePeriod;

        // Chainlink USD-denominated feeds store answers at 8 decimals, mostly
        uint256 decimalDelta = 18 - feed.decimals();

        (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
        if (answer <= 0) revert("chainlink price must be positive");
        if (block.timestamp < updatedAt) revert("updatedAt exceeds block time");

        uint256 deltaTime;
        unchecked {
            deltaTime = block.timestamp - updatedAt;
        }

        if (deltaTime > maxStalePeriod) revert("chainlink price expired");

        return uint256(answer) * (10 ** decimalDelta);
    }
}
