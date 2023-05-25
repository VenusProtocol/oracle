// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../libraries/PancakeLibrary.sol";
import "../interfaces/OracleInterface.sol";
import "../interfaces/VBep20Interface.sol";
import "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";

contract TwapOracle is AccessControlledV8, TwapInterface {
    struct Observation {
        uint256 timestamp;
        uint256 acc;
    }

    struct TokenConfig {
        /// @notice Asset address, which can't be zero address and can be used for existance check
        address asset;
        /// @notice Decimals of underlying asset respresented as 1e{decimals}
        uint256 baseUnit;
        /// @notice The address of Pancake pair
        address pancakePool;
        /// @notice Whether the token is paired with WBNB
        bool isBnbBased;
        /// @notice A flag identifies whether the Pancake pair is reversed
        /// e.g. XVS-WBNB is reversed, while WBNB-XVS is not.
        bool isReversedPool;
        /// @notice The minimum window in seconds required between TWAP updates
        uint256 anchorPeriod;
    }

    using FixedPoint for *;

    /// @notice WBNB address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable WBNB;

    /// @notice vBNB address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vBnb;

    /// @notice VAI address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vai;

    /// @notice the base unit of WBNB and BUSD, which are the paired tokens for all assets
    uint256 public constant BNB_BASE_UNIT = 1e18;
    uint256 public constant BUSD_BASE_UNIT = 1e18;

    /// @notice Configs by token
    mapping(address => TokenConfig) public tokenConfigs;

    /// @notice Stored price by token
    mapping(address => uint256) public prices;

    /// @notice Keeps a record of token observations mapped by address, updated on every updateTwap invocation.
    mapping(address => Observation[]) public observations;

    /// @notice Observation array index which probably falls in current anchor period mapped by asset address
    mapping(address => uint256) public windowStart;

    /// @notice Emit this event when TWAP window is updated
    event TwapWindowUpdated(
        address indexed asset,
        uint256 oldTimestamp,
        uint256 oldAcc,
        uint256 newTimestamp,
        uint256 newAcc
    );

    /// @notice Emit this event when TWAP price is updated
    event AnchorPriceUpdated(address indexed asset, uint256 price, uint256 oldTimestamp, uint256 newTimestamp);

    /// @notice Emit this event when new token configs are added
    event TokenConfigAdded(address indexed asset, address indexed pancakePool, uint256 indexed anchorPeriod);

    modifier notNullAddress(address someone) {
        if (someone == address(0)) revert("can't be zero address");
        _;
    }

    /// @notice Constructor for the implementation contract. Sets immutable variables.
    /// @param vBnbAddress The address of the VBNB
    /// @param wBnbAddress The address of the WBNB
    /// @param vaiAddress The address of the WBNB
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address vBnbAddress,
        address wBnbAddress,
        address vaiAddress
    ) notNullAddress(vBnbAddress) notNullAddress(wBnbAddress) notNullAddress(vaiAddress) {
        vBnb = vBnbAddress;
        WBNB = wBnbAddress;
        vai = vaiAddress;
        _disableInitializers();
    }

    /**
     * @notice Adds multiple token configs at the same time
     * @param configs Config array
     * @custom:error Zero length error thrown, if length of the config array is 0
     */
    function setTokenConfigs(TokenConfig[] memory configs) external {
        if (configs.length == 0) revert("length can't be 0");
        uint256 numTokenConfigs = configs.length;
        for (uint256 i; i < numTokenConfigs; ) {
            setTokenConfig(configs[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Get the underlying TWAP price for the given vToken
     * @param vToken vToken address
     * @return price Underlying price in USD
     * @custom:error Missing error is thrown if the token config does not exist
     * @custom:error Range error is thrown if TWAP price is not greater than zero
     */
    function getUnderlyingPrice(address vToken) external view override returns (uint256) {
        address asset = _getUnderlyingAsset(vToken);

        if (tokenConfigs[asset].asset == address(0)) revert("asset not exist");
        uint256 price = prices[asset];

        // if price is 0, it means the price hasn't been updated yet and it's meaningless, revert
        if (price == 0) revert("TWAP price must be positive");
        return (price * (10 ** (18 - IERC20Metadata(asset).decimals())));
    }

    /**
     * @notice Initializes the owner of the contract
     * @param accessControlManager_ Address of the access control manager contract
     */
    function initialize(address accessControlManager_) external initializer {
        __AccessControlled_init(accessControlManager_);
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
    ) public notNullAddress(config.asset) notNullAddress(config.pancakePool) {
        _checkAccessAllowed("setTokenConfig(TokenConfig)");

        if (config.anchorPeriod == 0) revert("anchor period must be positive");
        if (config.baseUnit != 10 ** IERC20Metadata(config.asset).decimals())
            revert("base unit decimals must be same as asset decimals");

        uint256 cumulativePrice = currentCumulativePrice(config);

        // Initialize observation data
        observations[config.asset].push(Observation(block.timestamp, cumulativePrice));
        tokenConfigs[config.asset] = config;
        emit TokenConfigAdded(config.asset, config.pancakePool, config.anchorPeriod);
    }

    /**
     * @notice Updates the current token/BUSD price from PancakeSwap, with 18 decimals of precision.
     * @return anchorPrice anchor price of the underlying asset of the vToken
     * @custom:error Missing error is thrown if token config does not exist
     */
    function updateTwap(address vToken) external returns (uint256) {
        address asset = _getUnderlyingAsset(vToken);

        if (tokenConfigs[asset].asset == address(0)) revert("asset not exist");
        // Update & fetch WBNB price first, so we can calculate the price of WBNB paired token
        if (asset != WBNB && tokenConfigs[asset].isBnbBased) {
            if (tokenConfigs[WBNB].asset == address(0)) revert("WBNB not exist");
            _updateTwapInternal(tokenConfigs[WBNB]);
        }
        return _updateTwapInternal(tokenConfigs[asset]);
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
     * @notice Fetches the current token/BUSD price from PancakeSwap, with 18 decimals of precision.
     * @return price Underlying price in USD, with 18 decimals
     * @custom:error Timing error is thrown if current time is not greater than old observation timestamp
     * @custom:error Zero price error is thrown if token is BNB based and price is zero
     * @custom:error Zero price error is thrown if fetched anchorPriceMantissa is zero
     * @custom:event Emits AnchorPriceUpdated event on successful update of observation with assset address,
     * AnchorPrice, old observation timestamp and current timestamp
     */
    function _updateTwapInternal(TokenConfig memory config) private returns (uint256) {
        // pokeWindowValues already handled reversed pool cases,
        // priceAverage will always be Token/BNB or Token/BUSD *twap** price.
        (uint256 nowCumulativePrice, uint256 oldCumulativePrice, uint256 oldTimestamp) = pokeWindowValues(config);

        if (block.timestamp == oldTimestamp) return prices[config.asset];

        // This should be impossible, but better safe than sorry
        if (block.timestamp < oldTimestamp) revert("now must come after before");

        uint256 timeElapsed;
        unchecked {
            timeElapsed = block.timestamp - oldTimestamp;
        }

        // Calculate Pancake *twap**
        FixedPoint.uq112x112 memory priceAverage = FixedPoint.uq112x112(
            uint224((nowCumulativePrice - oldCumulativePrice) / timeElapsed)
        );
        // *twap** price with 1e18 decimal mantissa
        uint256 priceAverageMantissa = priceAverage.decode112with18();

        // To cancel the decimals in cumulative price, we need to mulitply the average price with
        // tokenBaseUnit / (BNB_BASE_UNIT or BUSD_BASE_UNIT, which is 1e18)
        uint256 pairedTokenBaseUnit = config.isBnbBased ? BNB_BASE_UNIT : BUSD_BASE_UNIT;
        uint256 anchorPriceMantissa = (priceAverageMantissa * config.baseUnit) / pairedTokenBaseUnit;

        // if this token is paired with BNB, convert its price to USD
        if (config.isBnbBased) {
            uint256 bnbPrice = prices[WBNB];
            if (bnbPrice == 0) revert("bnb price is invalid");
            anchorPriceMantissa = (anchorPriceMantissa * bnbPrice) / BNB_BASE_UNIT;
        }

        if (anchorPriceMantissa == 0) revert("twap price cannot be 0");

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
    ) private returns (uint256, uint256 startCumulativePrice, uint256 startCumulativeTimestamp) {
        uint256 cumulativePrice = currentCumulativePrice(config);
        uint256 currentTimestamp = block.timestamp;
        uint256 windowStartTimestamp = currentTimestamp - config.anchorPeriod;
        Observation[] memory storedObservations = observations[config.asset];

        uint256 storedObservationsLength = storedObservations.length;
        for (uint256 windowStartIndex = windowStart[config.asset]; windowStartIndex < storedObservationsLength; ) {
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

            unchecked {
                ++windowStartIndex;
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

    /**
     * @dev This function returns the underlying asset of a vToken
     * @param vToken vToken address
     * @return asset underlying asset address
     */
    function _getUnderlyingAsset(address vToken) private view returns (address asset) {
        if (vToken == vBnb) {
            asset = WBNB;
        } else if (vToken == vai) {
            asset = vai;
        } else {
            asset = VBep20Interface(vToken).underlying();
        }
    }
}
