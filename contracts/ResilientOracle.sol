// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./interfaces/OracleInterface.sol";


contract ResilientOracle is OwnableUpgradeable, PausableUpgradeable {
    using SafeMath for uint256;

    uint256 public constant INVALID_PRICE = 0;

    /**
     * @dev oracle role, we have 3 roles at the moment
     * MAIN: The most trustworthy price source
     * PIVOT: Not so trustworthy price source, used as a loose sanity checker
     * FALLBACK: The backup source when main oracle price is invalidated
     */
    enum OracleRole {
        MAIN,
        PIVOT,
        FALLBACK
    }

    struct TokenConfig {
        /// @notice vToken address
        address vToken;
        /// @notice `oracles` stores the oracles in the order of: [main, pivot, fallback], 
        /// it can be indexed with enum OracleRole value
        address[3] oracles;
        /// @notice `enableFlagsForOracles` stores the oracle enable statuses
        /// for each oracle in the same order as `oracles`
        bool[3] enableFlagsForOracles;
    }

    mapping(address => TokenConfig) private tokenConfigs;

    event GlobalEnable(bool indexed isEnable);
    event TokenConfigAdded(
        address indexed token,
        address indexed mainOracle, 
        address indexed pivotOracle, 
        address fallbackOracle
    );
    event OracleSet(address indexed vToken, address indexed oracle, uint indexed role);
    event OracleEnabled(address indexed vToken, uint indexed role, bool indexed enable);

    modifier notNullAddress(address someone) {
        require(someone != address(0), "can't be zero address");
        _;
    }

    /**
     * @notice Check whether token config exist by checking whether vToken is zero address
     * @dev vToken can't be set to zero, so it's suitable to be used to check
     * @param vToken vtoken address
     */
    modifier checkTokenConfigExistance(address vToken) {
        require(tokenConfigs[vToken].vToken != address(0), "token config must exist");
        _;
    }

    function initialize() public initializer {
        __Ownable_init();
        __Pausable_init();
    }
    
    /**
     * @notice Pause protocol
     */
    function pause() external onlyOwner() {
        _pause();
    }

    /**
     * @notice Unpause protocol
     */
    function unpause() external onlyOwner() {
        _unpause();
    }

    /**
     * @dev Get token config by vToken address 
     * @param vToken vtoken address
     */
    function getTokenConfig(address vToken) external view returns (TokenConfig memory) {
        return tokenConfigs[vToken];
    }

    /**
     * @notice Get oracle & enabling status by vToken address 
     * @param vToken vtoken address
     * @param role oracle role
     */
    function getOracle(address vToken, OracleRole role) public view returns (address oracle, bool enabled) {
        oracle = tokenConfigs[vToken].oracles[uint(role)];
        enabled = tokenConfigs[vToken].enableFlagsForOracles[uint(role)];
    }

    /**
     * @notice Batch set token configs
     * @param tokenConfigs_ token config array
     */
    function setTokenConfigs(TokenConfig[] memory tokenConfigs_) external onlyOwner() {
        require(tokenConfigs_.length != 0, "length can't be 0");
        for (uint256 i = 0; i < tokenConfigs_.length; i++) {
            setTokenConfig(tokenConfigs_[i]);
        }
    }

    /**
     * @notice Set single token configs, vToken MUST HAVE NOT be added before, and main oracle MUST NOT be zero address
     * @param tokenConfig token config struct
     */
    function setTokenConfig(TokenConfig memory tokenConfig) public 
        onlyOwner()
        notNullAddress(tokenConfig.vToken)
        notNullAddress(tokenConfig.oracles[uint(OracleRole.MAIN)])
    {
        tokenConfigs[tokenConfig.vToken] = tokenConfig;
        emit TokenConfigAdded(
            tokenConfig.vToken,
            tokenConfig.oracles[uint(OracleRole.MAIN)],
            tokenConfig.oracles[uint(OracleRole.PIVOT)],
            tokenConfig.oracles[uint(OracleRole.FALLBACK)]
        );
    }

    /**
     * @notice Set oracle of any type for the input vToken, input vToken MUST exist
     * @param vToken vToken address
     * @param oracle oracle address
     * @param role oracle role
     */
    function setOracle(address vToken, address oracle, OracleRole role) external
        onlyOwner()
        notNullAddress(vToken)
        checkTokenConfigExistance(vToken)
    {
        require(!(oracle == address(0) && role == OracleRole.MAIN), "can't set zero address to main oracle");
        tokenConfigs[vToken].oracles[uint(role)] = oracle;
        emit OracleSet(vToken, oracle, uint(role));
    }

    /**
     * @notice Enable/disable oracle for the input vToken, input vToken MUST exist
     * @param vToken vToken address
     * @param role oracle role
     * @param enable expected status
     */
    function enableOracle(address vToken, OracleRole role, bool enable) external
        onlyOwner()
        notNullAddress(vToken)
        checkTokenConfigExistance(vToken)
    {
        tokenConfigs[vToken].enableFlagsForOracles[uint(role)] = enable;
        emit OracleEnabled(vToken, uint(role), enable);
    }

    /**
     * @notice Get price of underlying asset of the input vToken, check flow:
     * - check the global pausing status
     * - check price from main oracle
     * - check price against pivot oracle, if any
     * - if fallback flag is enabled and price is invalidated, fallback
     * @param vToken vToken address
     * @return price USD price in 18 decimals
     */
    function getUnderlyingPrice(address vToken) external view returns (uint256) {
        uint256 price = getUnderlyingPriceInternal(vToken);
        (address fallbackOracle, bool fallbackEnabled) = getOracle(vToken, OracleRole.FALLBACK);
        if (price == INVALID_PRICE && fallbackEnabled && fallbackOracle != address(0)) {
            uint256 fallbackPrice = OracleInterface(fallbackOracle).getUnderlyingPrice(vToken);
            require(fallbackPrice != INVALID_PRICE, "fallback oracle price must be positive");
            return fallbackPrice;
        }
        // if price is 0 here, it means main oracle price is 0 or got invalidated by pivot oracle
        // and fallback oracle is not active, we revert it
        require(price != INVALID_PRICE, "invalid resilient oracle price");
        return price;
    }

    /**
     * @notice This function won't revert when price is 0, because the fallback oracle may come to play later
     * @param vToken vToken address
     * @return price USD price in 18 decimals
     */
    function getUnderlyingPriceInternal(address vToken) internal view returns (uint256) {
        // Global emergency switch
        require(!paused(), "resilient oracle is paused");

        (address mainOracle, bool mainOracleEnabled) = getOracle(vToken, OracleRole.MAIN);

        uint price = INVALID_PRICE;

        if (!mainOracleEnabled) {
            return price;
        }

        price = OracleInterface(mainOracle).getUnderlyingPrice(vToken);

        (address pivotOracle, bool pivotOracleEnabled) = getOracle(vToken, OracleRole.PIVOT);
        
        // Price oracle is not mandantory
        if (pivotOracle == address(0) || !pivotOracleEnabled) {
            return price;
        }

        // Check the price with pivot oracle
        bool pass = PivotOracleInterface(pivotOracle).validatePrice(vToken, price);
        if (!pass) {
            return INVALID_PRICE;
        }

        return price;
    }
}