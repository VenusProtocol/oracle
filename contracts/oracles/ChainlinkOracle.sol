// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "../interfaces/VBep20Interface.sol";
import "../interfaces/OracleInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";

contract ChainlinkOracle is AccessControlledV8, OracleInterface {
    struct TokenConfig {
        /// @notice Underlying token address, which can't be a null address and can be used to check if a token is supported
        /// @notice 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB for BNB
        address asset;
        /// @notice Chainlink feed address
        address feed;
        /// @notice Price expiration period of this asset
        uint256 maxStalePeriod;
    }

    /// @notice vBNB address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vBnb;

    /// @notice VAI address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vai;

    /// @notice Set this as asset address for BNB. This is the underlying address for vBNB
    address public constant BNB_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice Manually set an override price, useful under extenuating conditions such as price feed failure
    mapping(address => uint256) public prices;

    /// @notice Token config by assets
    mapping(address => TokenConfig) public tokenConfigs;

    /// @notice Emit when a price is manually set
    event PricePosted(
        address indexed asset,
        uint256 previousPriceMantissa,
        uint256 requestedPriceMantissa,
        uint256 newPriceMantissa
    );

    /// @notice Emit when a token config is added
    event TokenConfigAdded(address indexed asset, address feed, uint256 maxStalePeriod);

    modifier notNullAddress(address someone) {
        if (someone == address(0)) revert("can't be zero address");
        _;
    }

    /// @notice Constructor for the implementation contract. Sets immutable variables.
    /// @param vBnbAddress The address of the vBNB
    /// @param vaiAddress The address of the VAI
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address vBnbAddress, address vaiAddress) notNullAddress(vBnbAddress) notNullAddress(vaiAddress) {
        vBnb = vBnbAddress;
        vai = vaiAddress;
        _disableInitializers();
    }

    /**
     * @notice Set the forced prices of the underlying token of input vToken
     * @param vToken vToken address
     * @param underlyingPriceMantissa price in 18 decimals
     * @custom:access Only Governance
     * @custom:error NotNullAddress thrown if address of vToken is null
     * @custom:event Emits PricePosted event on succesfully setup of underlying price
     */
    function setUnderlyingPrice(
        VBep20Interface vToken,
        uint256 underlyingPriceMantissa
    ) external notNullAddress(address(vToken)) {
        _checkAccessAllowed("setUnderlyingPrice(address,uint256)");

        address asset = address(vToken) == vBnb ? BNB_ADDR : address(vToken.underlying());
        uint256 previousPriceMantissa = prices[asset];
        prices[asset] = underlyingPriceMantissa;
        emit PricePosted(asset, previousPriceMantissa, prices[asset], prices[asset]);
    }

    /**
     * @notice Manually set the price of a given asset
     * @param asset Asset address
     * @param price Underlying price in 18 decimals
     * @custom:access Only Governance
     * @custom:event Emits PricePosted event on succesfully setup of underlying price
     */
    function setDirectPrice(address asset, uint256 price) external notNullAddress(asset) {
        _checkAccessAllowed("setDirectPrice(address,uint256)");

        uint256 previousPriceMantissa = prices[asset];
        prices[asset] = price;
        emit PricePosted(asset, previousPriceMantissa, price, price);
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
     * @notice Add single token config. vToken & feed cannot be null addresses and maxStalePeriod must be positive
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
     * @notice Gets the Chainlink price for the underlying asset of a given vToken, revert when vToken is a null address
     * @param vToken vToken address
     * @return price Underlying price in USD
     */
    function getUnderlyingPrice(address vToken) external view override returns (uint256) {
        return _getUnderlyingPriceInternal(VBep20Interface(vToken));
    }

    /**
     * @notice Gets the Chainlink price for the underlying asset of a given vToken
     * or the manually set price if it's been set
     * @dev The decimals of the underlying token are considered to ensure the returned price
     * has 18 decimals of precision
     * @param vToken vToken address
     * @return price Underlying price in USD
     */
    function _getUnderlyingPriceInternal(VBep20Interface vToken) private view returns (uint256 price) {
        address token;
        uint256 decimals;

        // vBNB token doesn't have `underlying` method
        if (address(vToken) == vBnb) {
            token = BNB_ADDR;
            decimals = 18;
        } else if (address(vToken) == vai) {
            token = vai;
            decimals = 18;
        } else {
            token = vToken.underlying();
            decimals = VBep20Interface(token).decimals();
        }

        uint256 tokenPrice = prices[token];
        if (tokenPrice != 0) {
            price = tokenPrice;
        } else {
            price = _getChainlinkPrice(token);
        }

        uint256 decimalDelta = 18 - uint256(decimals);
        return price * (10 ** decimalDelta);
    }

    /**
     * @notice Get the Chainlink price for the underlying asset of a given vToken, revert if token config doesn't exist
     * @dev The precision of the price feed is used to ensure the returned price has 18 decimals of precision
     * @param asset Underlying asset address
     * @return price Underlying price in USD, with 18 decimals of precision
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
