// SPDX-License-Identifier: BSD-3-Clause
// SPDX-FileCopyrightText: 2022 Venus
pragma solidity 0.8.13;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./interfaces/VBep20Interface.sol";
import "./interfaces/OracleInterface.sol";
import "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";

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

    /// @notice vBNB address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vBnb;

    /// @notice VAI address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vai;

    /// @notice Set this as asset address for BNB. This is the underlying for vBNB
    address public constant BNB_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    BoundValidatorInterface public boundValidator;

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
     * @notice Checks whether token config exists by checking whether vToken is null address
     * @dev vToken can't be null, so it's suitable to be used to check the validity of the config
     * @param asset asset address
     */
    modifier checkTokenConfigExistence(address asset) {
        if (tokenConfigs[asset].asset == address(0)) revert("token config must exist");
        _;
    }

    /// @notice Constructor for the implementation contract. Sets immutable variables.
    /// @param vBnbAddress The address of the vBNB
    /// @param vaiAddress The address of the VAI
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address vBnbAddress, address vaiAddress) notNullAddress(vBnbAddress) {
        vBnb = vBnbAddress;
        vai = vaiAddress;
        _disableInitializers();
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
     * @notice Sets oracle for a given vToken and role.
     * @dev Supplied vToken **must** exist and main oracle may not be null
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
     * @notice Enables/ disables oracle for the input vToken, input vToken **must** exist
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
        (address pivotOracle, bool pivotOracleEnabled) = getOracle(vToken, OracleRole.PIVOT);
        if (pivotOracle != address(0) && pivotOracleEnabled) {
            //if **pivot** oracle is PythOrcle it will revert so we need to catch the revert
            try TwapInterface(pivotOracle).updateTwap(vToken) {} catch {}
        }
    }

    /**
     * @dev Gets token config by vToken address
     * @param vToken vToken address
     * @return tokenConfig Config for the vToken
     */
    function getTokenConfig(address vToken) external view returns (TokenConfig memory) {
        address asset = _getUnderlyingAsset(vToken);
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
        uint256 pivotPrice = INVALID_PRICE;

        // Get pivot oracle price, Invalid price if not available or error
        (address pivotOracle, bool pivotOracleEnabled) = getOracle(vToken, OracleRole.PIVOT);
        if (pivotOracleEnabled && pivotOracle != address(0)) {
            try OracleInterface(pivotOracle).getUnderlyingPrice(vToken) returns (uint256 pricePivot) {
                pivotPrice = pricePivot;
            } catch {}
        }

        // Compare main price and pivot price, return main price and if validation was successful
        // note: In case pivot oracle is not available but main price is available and
        // validation is successful, the main oracle price is returned.
        (uint256 mainPrice, bool validatedPivotMain) = _getMainOraclePrice(
            vToken,
            pivotPrice,
            pivotOracleEnabled && pivotOracle != address(0)
        );
        if (mainPrice != INVALID_PRICE && validatedPivotMain) return mainPrice;

        // Compare fallback and pivot if main oracle comparision fails with pivot
        // Return fallback price when fallback price is validated successfully with pivot oracle
        (uint256 fallbackPrice, bool validatedPivotFallback) = _getFallbackOraclePrice(vToken, pivotPrice);
        if (fallbackPrice != INVALID_PRICE && validatedPivotFallback) return fallbackPrice;

        // Lastly compare main price and fallback price
        if (
            mainPrice != INVALID_PRICE &&
            fallbackPrice != INVALID_PRICE &&
            boundValidator.validatePriceWithAnchorPrice(vToken, mainPrice, fallbackPrice)
        ) {
            return mainPrice;
        }

        revert("invalid resilient oracle price");
    }

    /**
     * @notice Initializes the contract admin and sets the BoundValidator contract address
     * @param _boundValidator Address of the bound validator contract
     * @param accessControlManager_ Address of the access control manager contract
     */
    function initialize(BoundValidatorInterface _boundValidator, address accessControlManager_) public initializer {
        if (address(_boundValidator) == address(0)) revert("invalid bound validator address");
        boundValidator = _boundValidator;

        __AccessControlled_init(accessControlManager_);
        __Pausable_init();
    }

    /**
     * @notice Sets/resets single token configs.
     * @dev main oracle **must not** be a null address
     * @param tokenConfig Token config struct
     * @custom:access Only Governance
     * @custom:error NotNullAddress is thrown if asset address is null
     * @custom:error NotNullAddress is thrown if main-role oracle address for asset is null
     * @custom:event Emits TokenConfigAdded event when vToken config is set successfully by governnace
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
     * @notice Gets oracle and enabled status by vToken address
     * @param vToken vToken address
     * @param role Oracle role
     * @return oracle Oracle address based on role
     * @return enabled Enabled flag of the oracle based on token config
     */
    function getOracle(address vToken, OracleRole role) public view returns (address oracle, bool enabled) {
        address asset = _getUnderlyingAsset(vToken);

        oracle = tokenConfigs[asset].oracles[uint256(role)];
        enabled = tokenConfigs[asset].enableFlagsForOracles[uint256(role)];
    }

    /**
     * @notice Gets underlying asset price for the provided vToken
     * @dev This function won't revert when price is 0, because the fallback oracle may still be
     * able to fetch a correct price
     * @param vToken vToken address
     * @param pivotPrice Pivot oracle price
     * @param pivotEnabled If pivot oracle is not empty and enabled
     * @return price USD price in scaled decimals
     * e.g. vToken decimals is 8 then price is returned as 10**18 * 10**(18-8) = 10**28 decimals
     * @return pivotValidated Boolean representing if the validation of main oracle price
     * and pivot oracle price were successful
     * @custom:error Invalid price error is thrown if main oracle fails to fetch price of underlying asset
     * @custom:error Invalid price error is thrown if main oracle is not enabled or main oracle
     * address is null
     */
    function _getMainOraclePrice(
        address vToken,
        uint256 pivotPrice,
        bool pivotEnabled
    ) internal view returns (uint256, bool) {
        (address mainOracle, bool mainOracleEnabled) = getOracle(vToken, OracleRole.MAIN);
        if (mainOracleEnabled && mainOracle != address(0)) {
            try OracleInterface(mainOracle).getUnderlyingPrice(vToken) returns (uint256 mainOraclePrice) {
                if (!pivotEnabled) {
                    return (mainOraclePrice, true);
                }
                if (pivotPrice == INVALID_PRICE) {
                    return (mainOraclePrice, false);
                }
                return (
                    mainOraclePrice,
                    boundValidator.validatePriceWithAnchorPrice(vToken, mainOraclePrice, pivotPrice)
                );
            } catch {
                return (INVALID_PRICE, false);
            }
        }

        return (INVALID_PRICE, false);
    }

    /**
     * @dev This function won't revert when the price is 0 because getUnderlyingPrice checks if price is > 0
     * @param vToken vToken address
     * @return price USD price in 18 decimals
     * @return pivotValidated Boolean representing if the validation of fallback oracle price
     * and pivot oracle price were successfull
     * @custom:error Invalid price error is thrown if fallback oracle fails to fetch price of underlying asset
     * @custom:error Invalid price error is thrown if fallback oracle is not enabled or fallback oracle
     * address is null
     */
    function _getFallbackOraclePrice(address vToken, uint256 pivotPrice) internal view returns (uint256, bool) {
        (address fallbackOracle, bool fallbackEnabled) = getOracle(vToken, OracleRole.FALLBACK);
        if (fallbackEnabled && fallbackOracle != address(0)) {
            try OracleInterface(fallbackOracle).getUnderlyingPrice(vToken) returns (uint256 fallbackOraclePrice) {
                if (pivotPrice == INVALID_PRICE) {
                    return (fallbackOraclePrice, false);
                }
                return (
                    fallbackOraclePrice,
                    boundValidator.validatePriceWithAnchorPrice(vToken, fallbackOraclePrice, pivotPrice)
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
    function _getUnderlyingAsset(address vToken) internal view returns (address asset) {
        if (address(vToken) == vBnb) {
            asset = BNB_ADDR;
        } else if (address(vToken) == vai) {
            asset = vai;
        } else {
            asset = VBep20Interface(vToken).underlying();
        }
    }
}
