// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { OracleInterface } from "../../interfaces/OracleInterface.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { CappedOracle } from "./CappedOracle.sol";

/**
 * @title CorrelatedTokenOracle
 * @notice This oracle fetches the price of a token that is correlated to another token.
 */
abstract contract CorrelatedTokenOracle is CappedOracle {
    /// @notice Address of the correlated token
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable CORRELATED_TOKEN;

    /// @notice Address of the underlying token
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable UNDERLYING_TOKEN;

    /// @notice Address of Resilient Oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    OracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Thrown if the token address is invalid
    error InvalidTokenAddress();

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address correlatedToken,
        address underlyingToken,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 snapshotInterval
    ) CappedOracle(annualGrowthRate, snapshotInterval) {
        ensureNonzeroAddress(correlatedToken);
        ensureNonzeroAddress(underlyingToken);
        ensureNonzeroAddress(resilientOracle);

        CORRELATED_TOKEN = correlatedToken;
        UNDERLYING_TOKEN = underlyingToken;
        RESILIENT_ORACLE = OracleInterface(resilientOracle);
    }

    /**
     * @notice Fetches the uncapped price of the correlated token
     * @param asset Address of the correlated token
     * @return price The price of the correlated token in scaled decimal places
     */
    function getUncappedPrice(address asset) internal view override returns (uint256) {
        if (asset != CORRELATED_TOKEN) revert InvalidTokenAddress();

        uint256 underlyingAmount = _getUnderlyingAmount();
        uint256 underlyingUSDPrice = RESILIENT_ORACLE.getPrice(UNDERLYING_TOKEN);

        IERC20Metadata token = IERC20Metadata(CORRELATED_TOKEN);
        uint256 decimals = token.decimals();

        return (underlyingAmount * underlyingUSDPrice) / (10 ** decimals);
    }

    /**
     * @notice Address of the correlated token
     * @return address Address of the correlated token
     */
    function token() internal view override returns (address) {
        return CORRELATED_TOKEN;
    }

    /**
     * @notice Gets the underlying amount for correlated token
     * @return underlyingAmount Amount of underlying token
     */
    function _getUnderlyingAmount() internal view virtual returns (uint256);
}
