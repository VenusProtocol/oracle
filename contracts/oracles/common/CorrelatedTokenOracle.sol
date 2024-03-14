// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../../interfaces/OracleInterface.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title CorrelatedTokenOracle
 * @notice This oracle fetches the price of a token that is correlated to another token.
 */
abstract contract CorrelatedTokenOracle is OracleInterface {
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
    constructor(address correlatedToken, address underlyingToken, address resilientOracle) {
        ensureNonzeroAddress(correlatedToken);
        ensureNonzeroAddress(underlyingToken);
        ensureNonzeroAddress(resilientOracle);
        CORRELATED_TOKEN = correlatedToken;
        UNDERLYING_TOKEN = underlyingToken;
        RESILIENT_ORACLE = OracleInterface(resilientOracle);
    }

    /**
     * @notice Fetches the price of the correlated token
     * @param asset Address of the correlated token
     * @return price The price of the correlated token in scaled decimal places
     */
    function getPrice(address asset) external view override returns (uint256) {
        if (asset != CORRELATED_TOKEN) revert InvalidTokenAddress();

        // get underlying token amount for 1 correlated token scaled by underlying token decimals
        uint256 underlyingAmount = getUnderlyingAmount();

        // oracle returns (36 - asset decimal) scaled price
        uint256 underlyingUSDPrice = RESILIENT_ORACLE.getPrice(UNDERLYING_TOKEN);

        IERC20Metadata token = IERC20Metadata(CORRELATED_TOKEN);
        uint256 decimals = token.decimals();

        // underlyingAmount (for 1 correlated token) * underlyingUSDPrice / 1e18
        return (underlyingAmount * underlyingUSDPrice) / (10 ** decimals);
    }

    /**
     * @notice Gets the underlying amount for correlated token
     * @return underlyingAmount Amount of underlying token
     */
    function getUnderlyingAmount() internal view virtual returns (uint256);
}
