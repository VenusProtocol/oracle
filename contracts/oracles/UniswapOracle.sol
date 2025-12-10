// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IUniswapV3Pool } from "../interfaces/IUniswapV3Pool.sol";
import { ResilientOracleInterface } from "../interfaces/OracleInterface.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { FixedPoint96 } from "../libraries/FixedPoint96.sol";
import { FullMath } from "../libraries/FullMath.sol";

/**
 * @title UniswapOracle
 * @author Venus
 * @notice Oracle contract for fetching asset prices from Uniswap V3
 */
contract UniswapOracle is AccessControlledV8 {
    /// @notice Resilient Oracle for getting reference token prices
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    ResilientOracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Mapping of token addresses to their pool addresses
    mapping(address => address) public tokenPools;

    /// @notice Emitted when a token's pool configuration is updated
    /// @param token The token address
    /// @param pool The pool address
    event PoolConfigUpdated(address indexed token, address indexed pool);

    /// @notice Thrown when a zero address is provided
    error ZeroAddress();

    /// @notice Thrown when an invalid pool address is provided
    error InvalidPool();

    /// @notice Thrown when token is not configured
    error TokenNotConfigured();

    /// @notice Thrown when price calculation fails
    error PriceCalculationError();

    /// @notice Constructor for UniswapPriceOracle
    /// @param resilientOracle_ Address of the resilient oracle
    constructor(ResilientOracleInterface resilientOracle_) {
        RESILIENT_ORACLE = resilientOracle_;

        // Note that the contract is upgradeable. Use initialize() or reinitializers
        // to set the state variables.
        _disableInitializers();
    }

    /// @notice Initialize the contract
    /// @param accessControlManager_ Address of the access control manager
    function initialize(address accessControlManager_) external initializer {
        __AccessControlled_init(accessControlManager_);
    }

    /// @notice Set pool configuration for a token
    /// @param token Address of the token
    /// @param pool Address of the Uniswap V3 pool
    function setPoolConfig(address token, address pool) external {
        _checkAccessAllowed("setPoolConfig(address,address)");

        if (token == address(0)) revert ZeroAddress();
        if (pool == address(0)) revert ZeroAddress();

        tokenPools[token] = pool;
        emit PoolConfigUpdated(token, pool);
    }

    /// @notice Get the price of an asset from Uniswap V3
    /// @param asset Address of the asset
    /// @return price Price in (36 - asset decimals) format, same as ResilientOracle
    function getPrice(address asset) external view returns (uint256 price) {
        address pool = tokenPools[asset];
        if (pool == address(0)) revert TokenNotConfigured();

        return _getUniswapV3Price(pool, asset);
    }

    /// @notice Get token price from Uniswap V3 pool
    /// @param pool Uniswap V3 pool address
    /// @param token Target token address
    /// @return price Price in (36 - token decimals) format
    function _getUniswapV3Price(address pool, address token) internal view returns (uint256 price) {
        if (pool == address(0)) revert InvalidPool();

        IUniswapV3Pool v3Pool = IUniswapV3Pool(pool);
        address token0 = v3Pool.token0();
        address token1 = v3Pool.token1();
        (uint160 sqrtPriceX96, , , , , , ) = v3Pool.slot0();

        uint256 priceX96 = FullMath.mulDiv(sqrtPriceX96, sqrtPriceX96, FixedPoint96.Q96);

        address targetToken = token;
        address referenceToken;
        bool targetIsToken0;

        if (token == token0) {
            targetIsToken0 = true;
            referenceToken = token1;
        } else if (token == token1) {
            targetIsToken0 = false;
            referenceToken = token0;
        } else {
            revert InvalidPool();
        }

        uint256 referencePrice = RESILIENT_ORACLE.getPrice(referenceToken);
        uint8 targetDecimals = IERC20Metadata(targetToken).decimals();
        uint8 referenceDecimals = IERC20Metadata(referenceToken).decimals();
        uint8 targetPriceDecimals = 36 - targetDecimals;

        uint256 targetTokensPerReferenceToken;

        if (targetIsToken0) {
            targetTokensPerReferenceToken = FullMath.mulDiv(FixedPoint96.Q96 * (10 ** 18), 1, priceX96);
        } else {
            targetTokensPerReferenceToken = FullMath.mulDiv(priceX96 * (10 ** 18), 1, FixedPoint96.Q96);
        }

        // Calculate intermediate price in 18 decimals
        price = FullMath.mulDiv(
            referencePrice * (10 ** targetDecimals),
            (10 ** 18),
            targetTokensPerReferenceToken * (10 ** referenceDecimals)
        );

        // Convert from 18 decimals to target price decimals
        if (targetPriceDecimals != 18) {
            if (targetPriceDecimals > 18) {
                price = price * (10 ** (targetPriceDecimals - 18));
            } else {
                price = price / (10 ** (18 - targetPriceDecimals));
            }
        }
    }
}
