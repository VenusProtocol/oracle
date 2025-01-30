// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { ISfrxEthFraxOracle } from "../interfaces/ISfrxEthFraxOracle.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { OracleInterface } from "../interfaces/OracleInterface.sol";

/**
 * @title SFrxETHOracle
 * @author Venus
 * @notice This oracle fetches the price of sfrxETH
 */
contract SFrxETHOracle is AccessControlledV8, OracleInterface {
    /// @notice Address of SfrxEthFraxOracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    ISfrxEthFraxOracle public immutable SFRXETH_FRAX_ORACLE;

    /// @notice Address of sfrxETH
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable SFRXETH;

    /// @notice Maximum allowed price difference
    uint256 public maxAllowedPriceDifference;

    /// @notice Emits when the maximum allowed price difference is updated
    event MaxAllowedPriceDifferenceUpdated(uint256 oldMaxAllowedPriceDifference, uint256 newMaxAllowedPriceDifference);

    /// @notice Thrown if the price data is invalid
    error BadPriceData();

    /// @notice Thrown if the price difference exceeds the allowed limit
    error PriceDifferenceExceeded();

    /// @notice Thrown if the token address is invalid
    error InvalidTokenAddress();

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    /// @custom:error ZeroAddressNotAllowed is thrown when `_sfrxEthFraxOracle` or `_sfrxETH` are the zero address
    constructor(address _sfrxEthFraxOracle, address _sfrxETH) {
        ensureNonzeroAddress(_sfrxEthFraxOracle);
        ensureNonzeroAddress(_sfrxETH);

        SFRXETH_FRAX_ORACLE = ISfrxEthFraxOracle(_sfrxEthFraxOracle);
        SFRXETH = _sfrxETH;

        _disableInitializers();
    }

    /**
     * @notice Sets the contracts required to fetch prices
     * @param _accessControlManager Address of the access control manager contract
     * @param _maxAllowedPriceDifference Maximum allowed price difference
     * @custom:error ZeroValueNotAllowed is thrown if `_maxAllowedPriceDifference` is zero
     */
    function initialize(address _accessControlManager, uint256 _maxAllowedPriceDifference) external initializer {
        ensureNonzeroValue(_maxAllowedPriceDifference);

        __AccessControlled_init(_accessControlManager);
        maxAllowedPriceDifference = _maxAllowedPriceDifference;
    }

    /**
     * @notice Sets the maximum allowed price difference
     * @param _maxAllowedPriceDifference Maximum allowed price difference
     * @custom:error ZeroValueNotAllowed is thrown if `_maxAllowedPriceDifference` is zero
     */
    function setMaxAllowedPriceDifference(uint256 _maxAllowedPriceDifference) external {
        _checkAccessAllowed("setMaxAllowedPriceDifference(uint256)");
        ensureNonzeroValue(_maxAllowedPriceDifference);

        emit MaxAllowedPriceDifferenceUpdated(maxAllowedPriceDifference, _maxAllowedPriceDifference);
        maxAllowedPriceDifference = _maxAllowedPriceDifference;
    }

    /**
     * @notice Fetches the USD price of sfrxETH
     * @param asset Address of the sfrxETH token
     * @return price The price scaled by 1e18
     * @custom:error InvalidTokenAddress is thrown when the `asset` is not the sfrxETH token (`SFRXETH`)
     * @custom:error BadPriceData is thrown if the `SFRXETH_FRAX_ORACLE` oracle informs it has bad data
     * @custom:error ZeroValueNotAllowed is thrown if the prices (low or high, in USD) are zero
     * @custom:error PriceDifferenceExceeded is thrown if priceHigh/priceLow is greater than `maxAllowedPriceDifference`
     */
    function getPrice(address asset) external view returns (uint256) {
        if (asset != SFRXETH) revert InvalidTokenAddress();

        (bool isBadData, uint256 priceLow, uint256 priceHigh) = SFRXETH_FRAX_ORACLE.getPrices();

        if (isBadData) revert BadPriceData();

        // calculate price in USD
        uint256 priceHighInUSD = (EXP_SCALE ** 2) / priceLow;
        uint256 priceLowInUSD = (EXP_SCALE ** 2) / priceHigh;

        ensureNonzeroValue(priceHighInUSD);
        ensureNonzeroValue(priceLowInUSD);

        // validate price difference
        uint256 difference = (priceHighInUSD * EXP_SCALE) / priceLowInUSD;
        if (difference > maxAllowedPriceDifference) revert PriceDifferenceExceeded();

        // calculate and return average price
        return (priceHighInUSD + priceLowInUSD) / 2;
    }
}
