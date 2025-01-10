// SPDX-License-Identifier: BSD-3-Clause
// SPDX-FileCopyrightText: 2022 Venus
pragma solidity 0.8.25;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./interfaces/VBep20Interface.sol";
import "./interfaces/OracleInterface.sol";
import "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";

/**
 * @title ResilientOracle
 * @author Venus
 * @notice The Resilient Oracle is the main contract that the protocol uses to fetch prices of assets.
 *
 * DeFi protocols are vulnerable to price oracle failures including oracle manipulation and incorrectly
 * reported prices. If only one oracle is used, this creates a single point of failure and opens a vector
 * for attacking the protocol.
 *
 * The Resilient Oracle uses multiple sources and fallback mechanisms to provide accurate prices and protect
 * the protocol from oracle attacks. Currently it includes integrations with Chainlink, Pyth, Binance Oracle
 * and TWAP (Time-Weighted Average Price) oracles. TWAP uses PancakeSwap as the on-chain price source.
 *
 * For every market (vToken) we configure the main, pivot and fallback oracles. The oracles are configured per
 * vToken's underlying asset address. The main oracle oracle is the most trustworthy price source, the pivot
 * oracle is used as a loose sanity checker and the fallback oracle is used as a backup price source.
 *
 * To validate prices returned from two oracles, we use an upper and lower bound ratio that is set for every
 * market. The upper bound ratio represents the deviation between reported price (the price that’s being
 * validated) and the anchor price (the price we are validating against) above which the reported price will
 * be invalidated. The lower bound ratio presents the deviation between reported price and anchor price below
 * which the reported price will be invalidated. So for oracle price to be considered valid the below statement
 * should be true:

```
anchorRatio = anchorPrice/reporterPrice
isValid = anchorRatio <= upperBoundAnchorRatio && anchorRatio >= lowerBoundAnchorRatio
```

 * In most cases, Chainlink is used as the main oracle, TWAP or Pyth oracles are used as the pivot oracle depending
 * on which supports the given market and Binance oracle is used as the fallback oracle. For some markets we may
 * use Pyth or TWAP as the main oracle if the token price is not supported by Chainlink or Binance oracles.
 *
 * For a fetched price to be valid it must be positive and not stagnant. If the price is invalid then we consider the
 * oracle to be stagnant and treat it like it's disabled.
 */
contract ResilientOracle is PausableUpgradeable, AccessControlledV8, ResilientOracleInterface {
    /**
     * @dev Oracle roles:
     * **main**: The most trustworthy price source
     * **pivot**: Price oracle used as a loose sanity checker
     * **fallback**: The backup source when main oracle price is invalidated
     */
    enum OracleRole {
        MAIN,
        PIVOT,
        FALLBACK
    }

    struct TokenConfig {
        /// @notice asset address
        address asset;
        /// @notice `oracles` stores the oracles based on their role in the following order:
        /// [main, pivot, fallback],
        /// It can be indexed with the corresponding enum OracleRole value
        address[3] oracles;
        /// @notice `enableFlagsForOracles` stores the enabled state
        /// for each oracle in the same order as `oracles`
        bool[3] enableFlagsForOracles;
    }

    uint256 public constant INVALID_PRICE = 0;

    /// @notice Native market address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable nativeMarket;

    /// @notice VAI address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vai;

    /// @notice Set this as asset address for Native token on each chain.This is the underlying for vBNB (on bsc)
    /// and can serve as any underlying asset of a market that supports native tokens
    address public constant NATIVE_TOKEN_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice Bound validator contract address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    BoundValidatorInterface public immutable boundValidator;

    /// Slot to cache the asset's price, used for transient storage
    bytes32 public constant CACHE_SLOT = keccak256(abi.encode("venus-protocol/oracle/ResilientOracle/cache"));

    mapping(address => TokenConfig) private tokenConfigs;

    event TokenConfigAdded(
        address indexed asset,
        address indexed mainOracle,
        address indexed pivotOracle,
        address fallbackOracle
    );

    /// Event emitted when an oracle is set
    event OracleSet(address indexed asset, address indexed oracle, uint256 indexed role);

    /// Event emitted when an oracle is enabled or disabled
    event OracleEnabled(address indexed asset, uint256 indexed role, bool indexed enable);

    /**
     * @notice Checks whether an address is null or not
     */
    modifier notNullAddress(address someone) {
        if (someone == address(0)) revert("can't be zero address");
        _;
    }

    /**
     * @notice Checks whether token config exists by checking whether asset is null address
     * @dev address can't be null, so it's suitable to be used to check the validity of the config
     * @param asset asset address
     */
    modifier checkTokenConfigExistence(address asset) {
        if (tokenConfigs[asset].asset == address(0)) revert("token config must exist");
        _;
    }

    /// @notice Constructor for the implementation contract. Sets immutable variables.
    /// @dev nativeMarketAddress can be address(0) if on the chain we do not support native market
    ///      (e.g vETH on ethereum would not be supported, only vWETH)
    /// @param nativeMarketAddress The address of a native market (for bsc it would be vBNB address)
    /// @param vaiAddress The address of the VAI token (if there is VAI on the deployed chain).
    ///          Set to address(0) of VAI is not existent.
    /// @param _boundValidator Address of the bound validator contract
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address nativeMarketAddress,
        address vaiAddress,
        BoundValidatorInterface _boundValidator
    ) notNullAddress(address(_boundValidator)) {
        nativeMarket = nativeMarketAddress;
        vai = vaiAddress;
        boundValidator = _boundValidator;

        _disableInitializers();
    }

    /**
     * @notice Initializes the contract admin and sets the BoundValidator contract address
     * @param accessControlManager_ Address of the access control manager contract
     */
    function initialize(address accessControlManager_) external initializer {
        __AccessControlled_init(accessControlManager_);
        __Pausable_init();
    }

    /**
     * @notice Pauses oracle
     * @custom:access Only Governance
     */
    function pause() external {
        _checkAccessAllowed("pause()");
        _pause();
    }

    /**
     * @notice Unpauses oracle
     * @custom:access Only Governance
     */
    function unpause() external {
        _checkAccessAllowed("unpause()");
        _unpause();
    }

    /**
     * @notice Batch sets token configs
     * @param tokenConfigs_ Token config array
     * @custom:access Only Governance
     * @custom:error Throws a length error if the length of the token configs array is 0
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
     * @notice Sets oracle for a given asset and role.
     * @dev Supplied asset **must** exist and main oracle may not be null
     * @param asset Asset address
     * @param oracle Oracle address
     * @param role Oracle role
     * @custom:access Only Governance
     * @custom:error Null address error if main-role oracle address is null
     * @custom:error NotNullAddress error is thrown if asset address is null
     * @custom:error TokenConfigExistance error is thrown if token config is not set
     * @custom:event Emits OracleSet event with asset address, oracle address and role of the oracle for the asset
     */
    function setOracle(
        address asset,
        address oracle,
        OracleRole role
    ) external notNullAddress(asset) checkTokenConfigExistence(asset) {
        _checkAccessAllowed("setOracle(address,address,uint8)");
        if (oracle == address(0) && role == OracleRole.MAIN) revert("can't set zero address to main oracle");
        tokenConfigs[asset].oracles[uint256(role)] = oracle;
        emit OracleSet(asset, oracle, uint256(role));
    }

    /**
     * @notice Enables/ disables oracle for the input asset. Token config for the input asset **must** exist
     * @dev Configuration for the asset **must** already exist and the asset cannot be 0 address
     * @param asset Asset address
     * @param role Oracle role
     * @param enable Enabled boolean of the oracle
     * @custom:access Only Governance
     * @custom:error NotNullAddress error is thrown if asset address is null
     * @custom:error TokenConfigExistance error is thrown if token config is not set
     */
    function enableOracle(
        address asset,
        OracleRole role,
        bool enable
    ) external notNullAddress(asset) checkTokenConfigExistence(asset) {
        _checkAccessAllowed("enableOracle(address,uint8,bool)");
        tokenConfigs[asset].enableFlagsForOracles[uint256(role)] = enable;
        emit OracleEnabled(asset, uint256(role), enable);
    }

    /**
     * @notice Updates the TWAP pivot oracle price.
     * @dev This function should always be called before calling getUnderlyingPrice
     * @param vToken vToken address
     */
    function updatePrice(address vToken) external override {
        address asset = _getUnderlyingAsset(vToken);
        _updateAssetPrice(asset);
    }

    /**
     * @notice Updates the pivot oracle price. Currently using TWAP
     * @dev This function should always be called before calling getPrice
     * @param asset asset address
     */
    function updateAssetPrice(address asset) external {
        _updateAssetPrice(asset);
    }

    /**
     * @dev Gets token config by asset address
     * @param asset asset address
     * @return tokenConfig Config for the asset
     */
    function getTokenConfig(address asset) external view returns (TokenConfig memory) {
        return tokenConfigs[asset];
    }

    /**
     * @notice Gets price of the underlying asset for a given vToken. Validation flow:
     * - Check if the oracle is paused globally
     * - Validate price from main oracle against pivot oracle
     * - Validate price from fallback oracle against pivot oracle if the first validation failed
     * - Validate price from main oracle against fallback oracle if the second validation failed
     * In the case that the pivot oracle is not available but main price is available and validation is successful,
     * main oracle price is returned.
     * @param vToken vToken address
     * @return price USD price in scaled decimal places.
     * @custom:error Paused error is thrown when resilent oracle is paused
     * @custom:error Invalid resilient oracle price error is thrown if fetched prices from oracle is invalid
     */
    function getUnderlyingPrice(address vToken) external view override returns (uint256) {
        if (paused()) revert("resilient oracle is paused");

        address asset = _getUnderlyingAsset(vToken);
        return _getPrice(asset);
    }

    /**
     * @notice Gets price of the asset
     * @param asset asset address
     * @return price USD price in scaled decimal places.
     * @custom:error Paused error is thrown when resilent oracle is paused
     * @custom:error Invalid resilient oracle price error is thrown if fetched prices from oracle is invalid
     */
    function getPrice(address asset) external view override returns (uint256) {
        if (paused()) revert("resilient oracle is paused");
        return _getPrice(asset);
    }

    /**
     * @notice Sets/resets single token configs.
     * @dev main oracle **must not** be a null address
     * @param tokenConfig Token config struct
     * @custom:access Only Governance
     * @custom:error NotNullAddress is thrown if asset address is null
     * @custom:error NotNullAddress is thrown if main-role oracle address for asset is null
     * @custom:event Emits TokenConfigAdded event when the asset config is set successfully by the authorized account
     */
    function setTokenConfig(
        TokenConfig memory tokenConfig
    ) public notNullAddress(tokenConfig.asset) notNullAddress(tokenConfig.oracles[uint256(OracleRole.MAIN)]) {
        _checkAccessAllowed("setTokenConfig(TokenConfig)");

        tokenConfigs[tokenConfig.asset] = tokenConfig;
        emit TokenConfigAdded(
            tokenConfig.asset,
            tokenConfig.oracles[uint256(OracleRole.MAIN)],
            tokenConfig.oracles[uint256(OracleRole.PIVOT)],
            tokenConfig.oracles[uint256(OracleRole.FALLBACK)]
        );
    }

    /**
     * @notice Gets oracle and enabled status by asset address
     * @param asset asset address
     * @param role Oracle role
     * @return oracle Oracle address based on role
     * @return enabled Enabled flag of the oracle based on token config
     */
    function getOracle(address asset, OracleRole role) public view returns (address oracle, bool enabled) {
        oracle = tokenConfigs[asset].oracles[uint256(role)];
        enabled = tokenConfigs[asset].enableFlagsForOracles[uint256(role)];
    }

    /**
     * @notice Updates the pivot oracle price. Currently using TWAP
     * @dev Cache the asset price and return if already cached
     * @param asset asset address
     */
    function _updateAssetPrice(address asset) internal {
        if (_readCachedPrice(asset) != 0) {
            return;
        }

        (address pivotOracle, bool pivotOracleEnabled) = getOracle(asset, OracleRole.PIVOT);
        if (pivotOracle != address(0) && pivotOracleEnabled) {
            //if pivot oracle is not TwapOracle it will revert so we need to catch the revert
            try TwapInterface(pivotOracle).updateTwap(asset) {} catch {}
        }

        uint256 price = _getPrice(asset);
        _cachePrice(asset, price);
    }

    /**
     * @notice Cache the asset price into transient storage
     * @param key address of the asset
     * @param value asset price
     */
    function _cachePrice(address key, uint256 value) internal {
        bytes32 slot = keccak256(abi.encode(CACHE_SLOT, key));
        assembly ("memory-safe") {
            tstore(slot, value)
        }
    }

    /**
     * @notice Read cached price from transient storage
     * @param key address of the asset
     * @return value cached asset price
     */
    function _readCachedPrice(address key) internal view returns (uint256 value) {
        bytes32 slot = keccak256(abi.encode(CACHE_SLOT, key));
        assembly ("memory-safe") {
            value := tload(slot)
        }
    }

    function _getPrice(address asset) internal view returns (uint256) {
        uint256 pivotPrice = INVALID_PRICE;
        uint256 price;

        price = _readCachedPrice(asset);
        if (price != 0) {
            return price;
        }

        // Get pivot oracle price, Invalid price if not available or error
        (address pivotOracle, bool pivotOracleEnabled) = getOracle(asset, OracleRole.PIVOT);
        if (pivotOracleEnabled && pivotOracle != address(0)) {
            try OracleInterface(pivotOracle).getPrice(asset) returns (uint256 pricePivot) {
                pivotPrice = pricePivot;
            } catch {}
        }

        // Compare main price and pivot price, return main price and if validation was successful
        // note: In case pivot oracle is not available but main price is available and
        // validation is successful, the main oracle price is returned.
        (uint256 mainPrice, bool validatedPivotMain) = _getMainOraclePrice(
            asset,
            pivotPrice,
            pivotOracleEnabled && pivotOracle != address(0)
        );
        if (mainPrice != INVALID_PRICE && validatedPivotMain) return mainPrice;

        // Compare fallback and pivot if main oracle comparision fails with pivot
        // Return fallback price when fallback price is validated successfully with pivot oracle
        (uint256 fallbackPrice, bool validatedPivotFallback) = _getFallbackOraclePrice(asset, pivotPrice);
        if (fallbackPrice != INVALID_PRICE && validatedPivotFallback) return fallbackPrice;

        // Lastly compare main price and fallback price
        if (
            mainPrice != INVALID_PRICE &&
            fallbackPrice != INVALID_PRICE &&
            boundValidator.validatePriceWithAnchorPrice(asset, mainPrice, fallbackPrice)
        ) {
            return mainPrice;
        }

        revert("invalid resilient oracle price");
    }

    /**
     * @notice Gets a price for the provided asset
     * @dev This function won't revert when price is 0, because the fallback oracle may still be
     * able to fetch a correct price
     * @param asset asset address
     * @param pivotPrice Pivot oracle price
     * @param pivotEnabled If pivot oracle is not empty and enabled
     * @return price USD price in scaled decimals
     * e.g. asset decimals is 8 then price is returned as 10**18 * 10**(18-8) = 10**28 decimals
     * @return pivotValidated Boolean representing if the validation of main oracle price
     * and pivot oracle price were successful
     * @custom:error Invalid price error is thrown if main oracle fails to fetch price of the asset
     * @custom:error Invalid price error is thrown if main oracle is not enabled or main oracle
     * address is null
     */
    function _getMainOraclePrice(
        address asset,
        uint256 pivotPrice,
        bool pivotEnabled
    ) internal view returns (uint256, bool) {
        (address mainOracle, bool mainOracleEnabled) = getOracle(asset, OracleRole.MAIN);
        if (mainOracleEnabled && mainOracle != address(0)) {
            try OracleInterface(mainOracle).getPrice(asset) returns (uint256 mainOraclePrice) {
                if (!pivotEnabled) {
                    return (mainOraclePrice, true);
                }
                if (pivotPrice == INVALID_PRICE) {
                    return (mainOraclePrice, false);
                }
                return (
                    mainOraclePrice,
                    boundValidator.validatePriceWithAnchorPrice(asset, mainOraclePrice, pivotPrice)
                );
            } catch {
                return (INVALID_PRICE, false);
            }
        }

        return (INVALID_PRICE, false);
    }

    /**
     * @dev This function won't revert when the price is 0 because getPrice checks if price is > 0
     * @param asset asset address
     * @return price USD price in 18 decimals
     * @return pivotValidated Boolean representing if the validation of fallback oracle price
     * and pivot oracle price were successfully
     * @custom:error Invalid price error is thrown if fallback oracle fails to fetch price of the asset
     * @custom:error Invalid price error is thrown if fallback oracle is not enabled or fallback oracle
     * address is null
     */
    function _getFallbackOraclePrice(address asset, uint256 pivotPrice) private view returns (uint256, bool) {
        (address fallbackOracle, bool fallbackEnabled) = getOracle(asset, OracleRole.FALLBACK);
        if (fallbackEnabled && fallbackOracle != address(0)) {
            try OracleInterface(fallbackOracle).getPrice(asset) returns (uint256 fallbackOraclePrice) {
                if (pivotPrice == INVALID_PRICE) {
                    return (fallbackOraclePrice, false);
                }
                return (
                    fallbackOraclePrice,
                    boundValidator.validatePriceWithAnchorPrice(asset, fallbackOraclePrice, pivotPrice)
                );
            } catch {
                return (INVALID_PRICE, false);
            }
        }

        return (INVALID_PRICE, false);
    }

    /**
     * @dev This function returns the underlying asset of a vToken
     * @param vToken vToken address
     * @return asset underlying asset address
     */
    function _getUnderlyingAsset(address vToken) private view notNullAddress(vToken) returns (address asset) {
        if (vToken == nativeMarket) {
            asset = NATIVE_TOKEN_ADDR;
        } else if (vToken == vai) {
            asset = vai;
        } else {
            asset = VBep20Interface(vToken).underlying();
        }
    }
}
