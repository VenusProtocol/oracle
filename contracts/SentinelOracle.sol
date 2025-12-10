// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

import { OracleInterface } from "./interfaces/OracleInterface.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";

/**
 * @title SentinelOracle
 * @author Venus
 * @notice Aggregator oracle that routes price requests to appropriate DEX oracles
 */
contract SentinelOracle is AccessControlledV8 {
    /// @notice Configuration for token price source
    /// @param oracle Address of the DEX oracle to use for this token
    struct TokenConfig {
        address oracle;
    }

    /// @notice Mapping of token addresses to their oracle configuration
    mapping(address => TokenConfig) public tokenConfigs;

    /// @notice Emitted when a token's oracle configuration is updated
    /// @param token The token address
    /// @param oracle The oracle address
    event TokenOracleConfigUpdated(address indexed token, address indexed oracle);

    /// @notice Thrown when a zero address is provided
    error ZeroAddress();

    /// @notice Thrown when token is not configured
    error TokenNotConfigured();

    /// @notice Constructor for PriceSentinelOracle
    constructor() {
        // Note that the contract is upgradeable. Use initialize() or reinitializers
        // to set the state variables.
        _disableInitializers();
    }

    /// @notice Initialize the contract
    /// @param accessControlManager_ Address of the access control manager
    function initialize(address accessControlManager_) external initializer {
        __AccessControlled_init(accessControlManager_);
    }

    /// @notice Set oracle configuration for a token
    /// @param token Address of the token
    /// @param oracle Address of the DEX oracle to use
    function setTokenOracleConfig(address token, address oracle) external {
        _checkAccessAllowed("setTokenOracleConfig(address,address)");

        if (token == address(0)) revert ZeroAddress();
        if (oracle == address(0)) revert ZeroAddress();

        tokenConfigs[token] = TokenConfig({ oracle: oracle });
        emit TokenOracleConfigUpdated(token, oracle);
    }

    /// @notice Get the price of an asset from the configured DEX oracle
    /// @param asset Address of the asset
    /// @return price Price in (36 - asset decimals) format, same as ResilientOracle
    function getPrice(address asset) external view returns (uint256 price) {
        TokenConfig memory config = tokenConfigs[asset];
        if (config.oracle == address(0)) revert TokenNotConfigured();

        return OracleInterface(config.oracle).getPrice(asset);
    }
}
