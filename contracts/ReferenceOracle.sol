// SPDX-License-Identifier: BSD-3-Clause
// SPDX-FileCopyrightText: 2025 Venus
pragma solidity 0.8.25;

import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { ResilientOracleInterface, OracleInterface } from "./interfaces/OracleInterface.sol";

/**
 * @title ReferenceOracle
 * @author Venus
 * @notice Reference oracle is the oracle that is not used for production but required for
 * price monitoring. This oracle contains some extra configurations for assets required to
 * compute reference prices of their derivative assets (OneJump, ERC4626, Pendle, etc.)
 */
contract ReferenceOracle is Ownable2StepUpgradeable, OracleInterface {
    struct ExternalPrice {
        /// @notice asset address
        address asset;
        /// @notice price of the asset from an external source
        uint256 price;
    }

    /// @notice Slot to temporarily store price information from external sources
    /// like CMC/Coingecko, useful to compute prices of derivative assets based on
    /// prices of the base assets with no on chain price information
    bytes32 public constant PRICES_SLOT = keccak256(abi.encode("venus-protocol/oracle/ReferenceOracle/prices"));

    /// @notice Resilient oracle address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    ResilientOracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Oracle configuration for assets
    mapping(address => OracleInterface) public oracles;

    /// @notice Event emitted when an oracle is set
    event OracleConfigured(address indexed asset, address indexed oracle);

    /**
     * @notice Constructor for the implementation contract. Sets immutable variables.
     * @param resilientOracle Resilient oracle address
     * @custom:error ZeroAddressNotAllowed is thrown if resilient oracle address is null
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor(ResilientOracleInterface resilientOracle) {
        ensureNonzeroAddress(address(resilientOracle));
        RESILIENT_ORACLE = resilientOracle;
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract admin
     */
    function initialize() external initializer {
        __Ownable2Step_init();
    }

    /**
     * @notice Sets an oracle to use for a specific asset
     * @dev The production resilientOracle will be used if zero address is passed
     * @param asset Asset address
     * @param oracle Oracle address
     * @custom:access Only owner
     * @custom:error ZeroAddressNotAllowed is thrown if asset address is null
     * @custom:event Emits OracleConfigured event
     */
    function setOracle(address asset, OracleInterface oracle) external onlyOwner {
        ensureNonzeroAddress(asset);
        oracles[asset] = OracleInterface(oracle);
        emit OracleConfigured(asset, address(oracle));
    }

    /**
     * @notice Gets price of the asset assuming other assets have the defined price
     * @param asset asset address
     * @param externalPrices an array of prices for other assets
     * @return USD price in scaled decimal places
     */
    function getPriceAssuming(address asset, ExternalPrice[] memory externalPrices) external returns (uint256) {
        uint256 externalPricesCount = externalPrices.length;
        for (uint256 i = 0; i < externalPricesCount; ++i) {
            _storeExternalPrice(externalPrices[i].asset, externalPrices[i].price);
        }
        return _getPrice(asset);
    }

    /**
     * @notice Gets price of the asset
     * @param asset asset address
     * @return USD price in scaled decimal places
     */
    function getPrice(address asset) external view override returns (uint256) {
        return _getPrice(asset);
    }

    function _storeExternalPrice(address asset, uint256 price) internal {
        bytes32 slot = keccak256(abi.encode(PRICES_SLOT, asset));
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            tstore(slot, price)
        }
    }

    function _getPrice(address asset) internal view returns (uint256) {
        uint256 externalPrice = _loadExternalPrice(asset);
        if (externalPrice != 0) {
            return externalPrice;
        }
        OracleInterface oracle = oracles[asset];
        if (oracle != OracleInterface(address(0))) {
            return oracle.getPrice(asset);
        }
        return RESILIENT_ORACLE.getPrice(asset);
    }

    function _loadExternalPrice(address asset) internal view returns (uint256 value) {
        bytes32 slot = keccak256(abi.encode(PRICES_SLOT, asset));
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            value := tload(slot)
        }
    }
}
