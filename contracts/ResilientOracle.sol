// SPDX-License-Identifier: BSD-3-Clause
// SPDX-FileCopyrightText: 2022 Venus
pragma solidity 0.8.13;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./interfaces/VBep20Interface.sol";
import "./interfaces/OracleInterface.sol";

contract ResilientOracle is OwnableUpgradeable, PausableUpgradeable, ResilientOracleInterface {
    uint256 public constant INVALID_PRICE = 0;

    /// @notice vBNB address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vBnb;

    /// @notice Set this as asset address for BNB. This is the underlying for vBNB
    address public constant BNB_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    BoundValidatorInterface public boundValidator;

    /**
     * @dev oracle role, we have 3 roles at the moment
     * **main**: The most trustworthy price source
     * **pivot**: Not so trustworthy price source, used as a loose sanity checker
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
        /// @notice `oracles` stores the oracles in the order of: [main, pivot, fallback],
        /// it can be indexed with enum OracleRole value
        address[3] oracles;
        /// @notice `enableFlagsForOracles` stores the oracle enable statuses
        /// for each oracle in the same order as `oracles`
        bool[3] enableFlagsForOracles;
    }

    mapping(address => TokenConfig) private tokenConfigs;

    event TokenConfigAdded(
        address indexed asset,
        address indexed mainOracle,
        address indexed pivotOracle,
        address fallbackOracle
    );
    event OracleSet(address indexed asset, address indexed oracle, uint256 indexed role);
    event OracleEnabled(address indexed asset, uint256 indexed role, bool indexed enable);

    modifier notNullAddress(address someone) {
        require(someone != address(0), "can't be zero address");
        _;
    }

    /**
     * @notice Check whether token config exist by checking whether vToken is zero address
     * @dev vToken can't be set to zero, so it's suitable to be used to check
     * @param asset asset address
     */
    modifier checkTokenConfigExistance(address asset) {
        require(tokenConfigs[asset].asset != address(0), "token config must exist");
        _;
    }

    /// @notice Constructor for the implementation contract. Sets immutable variables.
    /// @param vBnbAddress The address of the VBNB
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address vBnbAddress) notNullAddress(vBnbAddress) {
        vBnb = vBnbAddress;
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract admin and sets the BoundValidator contract address
     * @param _boundValidator Address of the bound validator contract
     */
    function initialize(BoundValidatorInterface _boundValidator) public initializer {
        require(address(_boundValidator) != address(0), "invalid bound validator address");
        boundValidator = _boundValidator;

        __Ownable_init();
        __Pausable_init();
    }

    /**
     * @notice Pause oracle
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause oracle
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Get token config by vToken address
     * @param vToken vtoken address
     * @return tokenConfig config of the vToken
     */
    function getTokenConfig(address vToken) external view returns (TokenConfig memory) {
        address asset = address(vToken) == vBnb ? BNB_ADDR : VBep20Interface(vToken).underlying();
        return tokenConfigs[asset];
    }

    /**
     * @notice Get oracle & enabling status by vToken address
     * @param vToken vtoken address
     * @param role oracle role
     * @return oracle oracle address based on role
     * @return enabled enabled flag of the oracle based on token config
     */
    function getOracle(address vToken, OracleRole role) public view returns (address oracle, bool enabled) {
        address asset = address(vToken) == vBnb ? BNB_ADDR : VBep20Interface(vToken).underlying();
        oracle = tokenConfigs[asset].oracles[uint256(role)];
        enabled = tokenConfigs[asset].enableFlagsForOracles[uint256(role)];
    }

    /**
     * @notice Batch set token configs
     * @param tokenConfigs_ token config array
     * @custom:access Only Governance
     * @custom:error Length error if the lenght of the array is 0, passed in parameter
     */
    function setTokenConfigs(TokenConfig[] memory tokenConfigs_) external onlyOwner {
        require(tokenConfigs_.length != 0, "length can't be 0");
        uint256 numTokenConfigs = tokenConfigs_.length;
        for (uint256 i; i < numTokenConfigs; ++i) {
            setTokenConfig(tokenConfigs_[i]);
        }
    }

    /**
     * @notice Set/reset single token configs and main oracle **must not** be zero address
     * @param tokenConfig token config struct
     * @custom:access Only Governance
     * @custom:error NotNullAddress thrown if asset address is zero
     * @custom:error NotNullAddress thrown if main-role oracle address for asset is zero
     * @custom:event Emits TokenConfigAdded event when vToken config are set by governnace
     */
    function setTokenConfig(
        TokenConfig memory tokenConfig
    ) public onlyOwner notNullAddress(tokenConfig.asset) notNullAddress(tokenConfig.oracles[uint256(OracleRole.MAIN)]) {
        tokenConfigs[tokenConfig.asset] = tokenConfig;
        emit TokenConfigAdded(
            tokenConfig.asset,
            tokenConfig.oracles[uint256(OracleRole.MAIN)],
            tokenConfig.oracles[uint256(OracleRole.PIVOT)],
            tokenConfig.oracles[uint256(OracleRole.FALLBACK)]
        );
    }

    /**
     * @notice Set oracle of any type for the input vToken, input vToken **must** exist
     * @param asset asset address
     * @param oracle oracle address
     * @param role oracle role
     * @custom:access Only Governance
     * @custom:error Zero address error if main-role oracle password is set to zero
     * @custom:error NotNullAddress error thrown if asset address is zero
     * @custom:error TokenConfigExistance error thrown if token config is not set
     * @custom:event Emits OracleSet event with asset address, oracle address and role of the oracle for the asset
     */
    function setOracle(
        address asset,
        address oracle,
        OracleRole role
    ) external onlyOwner notNullAddress(asset) checkTokenConfigExistance(asset) {
        require(!(oracle == address(0) && role == OracleRole.MAIN), "can't set zero address to main oracle");
        tokenConfigs[asset].oracles[uint256(role)] = oracle;
        emit OracleSet(asset, oracle, uint256(role));
    }

    /**
     * @notice Enable/disable oracle for the input vToken, input vToken **must** exist
     * @param asset asset address
     * @param role oracle role
     * @param enable expected status
     * @custom:access Only Governance
     * @custom:error NotNullAddress error thrown if asset address is zero
     * @custom:error TokenConfigExistance error thrown if token config is not set
     */
    function enableOracle(
        address asset,
        OracleRole role,
        bool enable
    ) external onlyOwner notNullAddress(asset) checkTokenConfigExistance(asset) {
        tokenConfigs[asset].enableFlagsForOracles[uint256(role)] = enable;
        emit OracleEnabled(asset, uint256(role), enable);
    }

    /**
     * @notice Update the pivot oracle price. Currently using **twap**
     * @dev This function should be called every time before calling getUnderlyingPrice
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
     * @notice Get price of underlying asset of the input vToken, check flow:
     * - check the global pausing status
     * - check price from main oracle against pivot oracle
     * - check price from fallback oracle against pivot oracle or main oracle if fails
     * @param vToken vToken address
     * @return price USD price in scaled decimal places, In case pivot oracle is not available
     * but main price is available and validation is successful, main oracle price is returned.
     * @custom:error paused error thrown when resilent oracle is paused
     * @custom:error Invalid resilient oracle price error thrown if fetched prices from oracle is invalid
     */
    function getUnderlyingPrice(address vToken) external view override returns (uint256) {
        require(!paused(), "resilient oracle is paused");
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
            boundValidator.validatePriceWithAnchorPrice(vToken, fallbackPrice, mainPrice)
        ) {
            return mainPrice;
        }

        revert("invalid resilient oracle price");
    }

    /**
     * @notice Get asset underlying vToken asset price
     * @dev This function won't revert when price is 0, because the fallback oracle may still be
     * able to fetch a correct price
     * @param vToken vToken address
     * @param pivotPrice pivot oracle price
     * @param pivotEnabled if pivot oracle is not empty and enabled
     * @return price USD price in scaled decimals
     * e.g. vToken decimals is 8 then price is returned as 10**18 * 10**(18-8) = 10**28 decimals
     * @return pivotValidated Boolean representing if the validation of main oracle price
     * and pivot oracle price was successful
     * @custom:error Invalid price error thrown if main oracle fails to fetch price of underlying asset
     * @custom:error Invalid price error thrown if main oracle is not enabled or main oracle
     * address is zero
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
     * @notice This function won't revert when price is 0, because the getUnderlyingPrice checks if pirce is > 0
     * @param vToken vToken address
     * @return price USD price in 18 decimals
     * @return pivotValidated Boolean representing if the validation of fallback oracle price
     * and pivot oracle price was successfull
     * @custom:error Invalid price error thrown if fallback oracle fails to fetch price of underlying asset
     * @custom:error Invalid price error thrown if fallback oracle is not enabled or fallback oracle
     * address is zero
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
}
