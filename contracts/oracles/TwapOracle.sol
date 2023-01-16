// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../libraries/PancakeLibrary.sol";
import "../interfaces/OracleInterface.sol";
import "../interfaces/VBep20Interface.sol";

struct Observation {
    uint256 timestamp;
    uint256 acc;
}

struct TokenConfig {
    /// @notice Asset address, which can't be zero address and can be used for existance check
    address asset;
    /// @notice Decimals of underlying asset
    uint256 baseUnit;
    /// @notice The address of Pancake pair
    address pancakePool;
    /// @notice Whether the token is paired with WBNB
    bool isBnbBased;
    /// @notice A flag identifies whether the Pancake pair is reversed
    /// e.g. XVS-WBNB is not reversed, while WBNB-XVS is.
    bool isReversedPool;
    /// @notice The minimum window in seconds required between TWAP updates
    uint256 anchorPeriod;
}

contract TwapOracle is OwnableUpgradeable, TwapInterface {
    using FixedPoint for *;

    /// @notice WBNB address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable WBNB;

    /// @notice vBNB address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vBnb;

    /// @notice the base unit of WBNB and BUSD, which are the paired tokens for all assets
    uint256 public constant bnbBaseUnit = 1e18;
    uint256 public constant busdBaseUnit = 1e18;

    uint256 public constant expScale = 1e18;

    /// @notice Configs by token
    mapping(address => TokenConfig) public tokenConfigs;

    /// @notice Stored price by token
    mapping(address => uint256) public prices;

    /// @notice Emit this event when TWAP window is updated
    event TwapWindowUpdated(
        address indexed asset,
        uint256 oldTimestamp,
        uint256 oldAcc,
        uint256 newTimestamp,
        uint256 newAcc
    );

    /// @notice Keeps a record of token observations mapped by address, updated on every updateTwap invocation.
    mapping(address => Observation[]) public observations;

    /// @notice Observation array index which probably falls in current anchor period mapped by asset address
    mapping(address => uint256) public windowStart;

    /// @notice Emit this event when TWAP price is updated
    event AnchorPriceUpdated(address indexed asset, uint256 price, uint256 oldTimestamp, uint256 newTimestamp);

    /// @notice Emit this event when new token configs are added
    event TokenConfigAdded(address indexed asset, address indexed pancakePool, uint256 indexed anchorPeriod);

    modifier notNullAddress(address someone) {
        require(someone != address(0), "can't be zero address");
        _;
    }

    /// @notice Constructor for the implementation contract. Sets immutable variables.
    /// @param vBnbAddress The address of the VBNB
    /// @param wBnbAddress The address of the WBNB
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address vBnbAddress, address wBnbAddress) notNullAddress(vBnbAddress) notNullAddress(wBnbAddress) {
        vBnb = vBnbAddress;
        WBNB = wBnbAddress;
        _disableInitializers();
    }

    /**
     * @notice Initializes the owner of the contract and sets the contracts required
     */
    function initialize() public initializer {
        __Ownable_init();
    }

    /**
     * @notice Adds multiple token configs at the same time
     * @param configs Config array
     * @custom:error Zero length error thrown, if length of the config array is 0
     */
    function setTokenConfigs(TokenConfig[] memory configs) external onlyOwner {
        require(configs.length > 0, "length can't be 0");
        uint256 numTokenConfigs = configs.length;
        for (uint256 i; i < numTokenConfigs; ++i) {
            setTokenConfig(configs[i]);
        }
    }

    /**
     * @notice Adds a single token config
     * @param config token config struct
     * @custom:access Only Governance
     * @custom:error Range error is thrown if anchor period is not greater than zero
     * @custom:error Range error is thrown if base unit is not greater than zero
     * @custom:error Value error is thrown if base unit decimals is not the same as asset decimals
     * @custom:error NotNullAddress error is thrown if address of asset is null
     * @custom:error NotNullAddress error is thrown if PancakeSwap pool address is null
     * @custom:event Emits TokenConfigAdded event if new token config are added with
     * asset address, PancakePool address, anchor period address
     */
    function setTokenConfig(
        TokenConfig memory config
    ) public onlyOwner notNullAddress(config.asset) notNullAddress(config.pancakePool) {
        require(config.anchorPeriod > 0, "anchor period must be positive");
        require(config.baseUnit > 0, "base unit must be positive");
        require(
            config.baseUnit == 10 ** IERC20Metadata(config.asset).decimals(),
            "base unit decimals must be same as asset decimals"
        );

        uint256 cumulativePrice = currentCumulativePrice(config);

        // Initialize observation data
        observations[config.asset].push(Observation(block.timestamp, cumulativePrice));
        tokenConfigs[config.asset] = config;
        emit TokenConfigAdded(config.asset, config.pancakePool, config.anchorPeriod);
    }

    /**
     * @notice Get the underlying TWAP price for the given vToken
     * @param vToken vToken address
     * @return price Underlying price in USD
     * @custom:error Missing error is thrown if the token config does not exist
     * @custom:error Range error is thrown if TWAP price is not greater than zero
     */
    function getUnderlyingPrice(address vToken) external view override returns (uint256) {
        // VBNB token doesn't have `underlying` method, vBNB's underlying token is wBNB
        address asset = address(vToken) == vBnb ? WBNB : VBep20Interface(vToken).underlying();
        require(tokenConfigs[asset].asset != address(0), "asset not exist");
        uint256 price = prices[asset];

        // if price is 0, it means the price hasn't been updated yet and it's meaningless, revert
        require(price > 0, "TWAP price must be positive");
        return (price * (10 ** (18 - IERC20Metadata(asset).decimals())));
    }

    /**
     * @notice Fetches the current token/WBNB and token/BUSD price accumulator from PancakeSwap.
     * @return cumulative price of target token regardless of pair order
     */
    function currentCumulativePrice(TokenConfig memory config) public view returns (uint256) {
        (uint256 price0, uint256 price1, ) = PancakeOracleLibrary.currentCumulativePrices(config.pancakePool);
        if (config.isReversedPool) {
            return price1;
        } else {
            return price0;
        }
    }

    /**
     * @notice Updates the current token/BUSD price from PancakeSwap, with 18 decimals of precision.
     * @return vToken Address of vToken
     * @custom:error Missing error is thrown if token config does not exist
     */
    function updateTwap(address vToken) public returns (uint256) {
        // VBNB token doesn't have `underlying` method, vBNB's underlying token is wBNB
        address asset = address(vToken) == vBnb ? WBNB : VBep20Interface(vToken).underlying();
        require(tokenConfigs[asset].asset != address(0), "asset not exist");
        // Update & fetch WBNB price first, so we can calculate the price of WBNB paired token
        if (asset != WBNB && tokenConfigs[asset].isBnbBased) {
            require(tokenConfigs[WBNB].asset != address(0), "WBNB not exist");
            _updateTwapInternal(tokenConfigs[WBNB]);
        }
        return _updateTwapInternal(tokenConfigs[asset]);
    }

    /**
     * @notice Fetches the current token/BUSD price from PancakeSwap, with 18 decimals of precision.
     * @return price Underlying price in USD, with 18 decimals
     * @custom:error Timing error is thrown if current time is not greater than old observation timestamp
     * @custom:error Zero price error is thrown if token is BNB based and price is zero
     * @custom:error Zero price error is thrown if fetched anchorPriceMantissa is zero
     * @custom:event Emits AnchorPriceUpdated event on successful update of observation with assset address,
     * AnchorPrice, old observation timestamp and current timestamp
     */
    function _updateTwapInternal(TokenConfig memory config) internal virtual returns (uint256) {
        // pokeWindowValues already handled reversed pool cases,
        // priceAverage will always be Token/BNB or Token/BUSD *twap** price.
        (uint256 nowCumulativePrice, uint256 oldCumulativePrice, uint256 oldTimestamp) = pokeWindowValues(config);

        // This should be impossible, but better safe than sorry
        require(block.timestamp > oldTimestamp, "now must come after before");
        uint256 timeElapsed = block.timestamp - oldTimestamp;

        // Calculate Pancakge *twap**
        FixedPoint.uq112x112 memory priceAverage = FixedPoint.uq112x112(
            uint224((nowCumulativePrice - oldCumulativePrice) / timeElapsed)
        );
        // *twap** price with 1e18 decimal mantissa
        uint256 priceAverageMantissa = priceAverage.decode112with18();

        // To cancel the decimals in cumulative price, we need to mulitply the average price with
        // tokenBaseUnit / (wbnbBaseUnit or busdBaseUnit, which is 1e18)
        uint256 pairedTokenBaseUnit = config.isBnbBased ? bnbBaseUnit : busdBaseUnit;
        uint256 anchorPriceMantissa = (priceAverageMantissa * config.baseUnit) / pairedTokenBaseUnit;

        // if this token is paired with BNB, convert its price to USD
        if (config.isBnbBased) {
            uint256 bnbPrice = prices[WBNB];
            require(bnbPrice != 0, "bnb price is invalid");
            anchorPriceMantissa = (anchorPriceMantissa * bnbPrice) / bnbBaseUnit;
        }

        require(anchorPriceMantissa != 0, "twap price cannot be 0");

        emit AnchorPriceUpdated(config.asset, anchorPriceMantissa, oldTimestamp, block.timestamp);

        // save anchor price, which is 1e18 decimals
        prices[config.asset] = anchorPriceMantissa;

        return anchorPriceMantissa;
    }

    /**
     * @notice Appends current observation and pick an observation with a timestamp equal
     * or just greater than the window start timestamp. If one is not available,
     * then pick the last availableobservation. The window start index is updated in both the cases.
     * Only the current observation is saved, prior observations are deleted during this operation.
     * @return Tuple of cumulative price, old observation and timestamp
     * @custom:event Emits TwapWindowUpdated on successful calculation of cumulative price with asset address,
     * new observation timestamp, current timestamp, new observation price and cumulative price
     */
    function pokeWindowValues(
        TokenConfig memory config
    ) internal returns (uint256, uint256 startCumulativePrice, uint256 startCumulativeTimestamp) {
        uint256 cumulativePrice = currentCumulativePrice(config);
        uint256 currentTimestamp = block.timestamp;
        uint256 windowStartTimestamp = currentTimestamp - config.anchorPeriod;
        Observation[] memory storedObservations = observations[config.asset];

        uint256 storedObservationsLength = storedObservations.length;
        for (
            uint256 windowStartIndex = windowStart[config.asset];
            windowStartIndex < storedObservationsLength;
            ++windowStartIndex
        ) {
            if (
                (storedObservations[windowStartIndex].timestamp >= windowStartTimestamp) ||
                (windowStartIndex == storedObservationsLength - 1)
            ) {
                startCumulativePrice = storedObservations[windowStartIndex].acc;
                startCumulativeTimestamp = storedObservations[windowStartIndex].timestamp;
                windowStart[config.asset] = windowStartIndex;
                break;
            } else {
                delete observations[config.asset][windowStartIndex];
            }
        }

        observations[config.asset].push(Observation(currentTimestamp, cumulativePrice));
        emit TwapWindowUpdated(
            config.asset,
            startCumulativeTimestamp,
            startCumulativePrice,
            block.timestamp,
            cumulativePrice
        );
        return (cumulativePrice, startCumulativePrice, startCumulativeTimestamp);
    }
}
