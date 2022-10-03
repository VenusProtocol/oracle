// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../libraries/PancakeLibrary.sol";
import "../interfaces/OracleInterface.sol";


struct Observation {
    uint256 timestamp;
    uint256 acc;
}

struct TokenConfig {
    /// @notice vToken address, which can't be zero address and can be used for existance check
    address vToken;
    /// @notice Decimals of underlying asset
    uint256 baseUnit;
    /// @notice The address of pancake pair
    address pancakePool;
    /// @notice Whether the token is paired with WBNB
    bool isBnbBased;
    /// @notice A flag identifies whether the pancake pair is reversed
    /// e.g. XVS-WBNB is not reversed, while WBNB-XVS is.
    bool isReversedPool;
    /// @notice TWAP update period in second, which is the minimum time in seconds required to update TWAP window
    uint256 anchorPeriod;
}

contract TwapOracle is OwnableUpgradeable, OracleInterface {
    using SafeMath for uint256;
    using FixedPoint for *;

    /// @notice vBNB address
    address public vBNB;

    /// @notice the base unit of WBNB and BUSD, which are the paired tokens for all assets
    uint256 public constant bnbBaseUnit = 1e18;
    uint256 public constant busdBaseUnit = 1e18;

    uint256 public constant expScale = 1e18;

    /// @notice After how many blocks the price can be refreshed
    uint256 public priceRefreshInterval;

    /// @notice Configs by token
    mapping(address => TokenConfig) public tokenConfigs;

    /// @notice The current price observation of TWAP. With old and current observations
    /// we can calculate the TWAP between this range
    mapping(address => Observation) public newObservations;

    /// @notice The old price observation of TWAP
    mapping(address => Observation) public oldObservations;

    /// @notice Stored price by token 
    mapping(address => uint256) public prices;

    /// @notice Stores last updated price block number
    mapping(address => uint256) public lastUpdatedBlock;

    /// @notice Emit this event when TWAP window is updated
    event TwapWindowUpdated(
        address indexed vToken, 
        uint256 oldTimestamp, 
        uint256 oldAcc, 
        uint256 newTimestamp, 
        uint256 newAcc);

    /// @notice Emit this event when TWAP price is updated
    event AnchorPriceUpdated(
        address indexed vToken,
        uint256 price, 
        uint256 oldTimestamp, 
        uint256 newTimestamp
    );

    /// @notice Emit this event when new token configs are added
    event TokenConfigAdded(
        address indexed vToken, 
        address indexed pancakePool,
        uint256 indexed anchorPeriod
    );

    modifier notNullAddress(address someone) {
        require(someone != address(0), "can't be zero address");
        _;
    }

    function initialize(address vBNB_, uint256 _priceRefreshInterval) public initializer {
        __Ownable_init();
        require(vBNB_ != address(0), "vBNB can't be zero address");
        vBNB = vBNB_;
        priceRefreshInterval = _priceRefreshInterval;
    }

    /**
     * @notice Update the price refresh interval
     * @param _priceRefreshInterval new priceRefreshInterval value
     */
    function updatePriceRefreshInterval(uint256 _priceRefreshInterval) external onlyOwner() {
        priceRefreshInterval = _priceRefreshInterval;
    }

    /**
     * @notice Add multiple token configs at the same time
     * @param configs config array
     */
    function setTokenConfigs(TokenConfig[] memory configs) external onlyOwner() {
        require(configs.length > 0, "length can't be 0");
        for (uint8 i = 0; i < configs.length; i++) {
            setTokenConfig(configs[i]);
        }
    }

    /**
     * @notice Add single token configs
     * @param config token config struct
     */
    function setTokenConfig(TokenConfig memory config) public 
        onlyOwner()
        notNullAddress(config.vToken)
        notNullAddress(config.pancakePool)
    {
        require(config.anchorPeriod > 0, "anchor period must be positive");
        require(config.baseUnit > 0, "base unit must be positive");
        uint256 cumulativePrice = currentCumulativePrice(config);

        // Initialize observation data
        oldObservations[config.vToken].timestamp = block.timestamp;
        newObservations[config.vToken].timestamp = block.timestamp;
        oldObservations[config.vToken].acc = cumulativePrice;
        newObservations[config.vToken].acc = cumulativePrice;
        tokenConfigs[config.vToken] = config;
        emit TokenConfigAdded(
            config.vToken, 
            config.pancakePool,
            config.anchorPeriod
        );
    }

    /**
     * @notice Get the underlying TWAP price of input vToken
     * @param vToken vToken address
     * @return price in USD, with 18 decimals
     */
    function getUnderlyingPrice(address vToken) external override returns (uint256) {
        require(tokenConfigs[vToken].vToken != address(0), "vToken not exist");
        updateTwap(vToken);
        uint256 price = prices[vToken];

        // if price is 0, it means the price hasn't been updated yet and it's meaningless, revert
        require(price > 0, "TWAP price must be positive"); 
        return price;
    }

    /**
     * @notice Fetches the current token/WBNB and token/BUSD price accumulator from pancakeswap.
     * @return cumulative price of target token regardless of pair order 
     */
    function currentCumulativePrice(TokenConfig memory config) public view returns (uint256) {
        (uint256 price0, uint256 price1,) = PancakeOracleLibrary.currentCumulativePrices(config.pancakePool);
        if (config.isReversedPool) {
            return price1;
        } else {
            return price0;
        }
    }

    function updateTwap(address vToken) public returns (uint256) {
        require(tokenConfigs[vToken].vToken != address(0), "vTokne not exist");
        // Update & fetch WBNB price first, so we can calculate the price of WBNB paired token
        if (vToken != vBNB && tokenConfigs[vToken].isBnbBased) {
            updateTwap(vBNB);
        }
        return _updateTwapInternal(tokenConfigs[vToken]);
    }

    /**
     * @notice Fetches the current token/BUSD price from PancakeSwap, with 18 decimals of precision.
     * @return price in USD, with 18 decimals
     */
    function _updateTwapInternal(TokenConfig memory config) internal virtual returns (uint256) {
        if (block.number - lastUpdatedBlock[config.vToken] < priceRefreshInterval) {
            return prices[config.vToken];
        } else {
            lastUpdatedBlock[config.vToken] = block.number;
        }

        // pokeWindowValues already handled reversed pool cases, 
        // priceAverage will always be Token/BNB or Token/BUSD TWAP price.
        (uint256 nowCumulativePrice, uint256 oldCumulativePrice, uint256 oldTimestamp) = pokeWindowValues(config);

        // This should be impossible, but better safe than sorry
        require(block.timestamp > oldTimestamp, "now must come after before");
        uint256 timeElapsed = block.timestamp.sub(oldTimestamp);

        // Calculate Pancakge TWAP
        FixedPoint.uq112x112 memory priceAverage = FixedPoint.uq112x112(uint224(
            nowCumulativePrice.sub(oldCumulativePrice).div(timeElapsed)
        ));
        // TWAP price with 1e18 decimal mantissa
        uint256 priceAverageMantissa = priceAverage.decode112with18();

        // To cancel the decimals in cumulative price, we need to mulitply the average price with 
        // tokenBaseUnit / (wbnbBaseUnit or busdBaseUnit, which is 1e18)
        uint256 pairedTokenBaseUnit = config.isBnbBased ? bnbBaseUnit : busdBaseUnit;
        uint256 anchorPriceMantissa = priceAverageMantissa.mul(config.baseUnit).div(pairedTokenBaseUnit);

        // if this token is paired with BNB, convert its price to USD
        if (config.isBnbBased) {
            uint256 bnbPrice = prices[vBNB];
            require(bnbPrice != 0, "bnb price is invalid");
            anchorPriceMantissa = anchorPriceMantissa.mul(bnbPrice).div(bnbBaseUnit);
        }

        require(anchorPriceMantissa != 0, "twap price cannot be 0");

        emit AnchorPriceUpdated(config.vToken, anchorPriceMantissa, oldTimestamp, block.timestamp);
        
        // save anchor price, which is 1e18 decimals
        prices[config.vToken] = anchorPriceMantissa;

        return anchorPriceMantissa;
    }

    /**
     * @notice Update new and old observations of lagging window if period elapsed.
     * @return cumulative price & old observation
     */
    function pokeWindowValues(TokenConfig memory config) internal returns (uint256, uint256, uint256) {
        uint256 cumulativePrice = currentCumulativePrice(config);

        Observation memory newObservation = newObservations[config.vToken];

        // Update new and old observations if elapsed time is greater than or equal to anchor period
        uint256 timeElapsed = block.timestamp.sub(newObservation.timestamp);
        if (timeElapsed >= config.anchorPeriod) {
            oldObservations[config.vToken].timestamp = newObservation.timestamp;
            oldObservations[config.vToken].acc = newObservation.acc;

            newObservations[config.vToken].timestamp = block.timestamp;
            newObservations[config.vToken].acc = cumulativePrice;
            emit TwapWindowUpdated(
                config.vToken,
                newObservation.timestamp,
                block.timestamp, 
                newObservation.acc, 
                cumulativePrice
            );
        }
        return (cumulativePrice, oldObservations[config.vToken].acc, oldObservations[config.vToken].timestamp);
    }
}