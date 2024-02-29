// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../../interfaces/OracleInterface.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title LiquidStakedTokenOracle
 * @notice This oracle fetches the price of liquid staked tokens
 */
abstract contract LiquidStakedTokenOracle is OracleInterface {
    /// @notice Address of the liquid staked token
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable LIQUID_STAKED_TOKEN;

    /// @notice Address of the underlying token
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable UNDERLYING_TOKEN;

    /// @notice Address of Resilient Oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    OracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address _liquidStakedToken,
        address _underlyingToken,
        address _resilientOracle
    ) {
        ensureNonzeroAddress(_liquidStakedToken);
        ensureNonzeroAddress(_underlyingToken);
        ensureNonzeroAddress(_resilientOracle);
        LIQUID_STAKED_TOKEN = _liquidStakedToken;
        UNDERLYING_TOKEN = _underlyingToken;
        RESILIENT_ORACLE = OracleInterface(_resilientOracle);
    }

    /**
     * @notice Fetches the price of the liquid staked token
     * @param asset Address of the liquid staked token
     * @return price The price of the liquid staked token scalked by 1e18
     */
    function getPrice(address asset) external view override returns (uint256) {
        if (asset != LIQUID_STAKED_TOKEN) revert("wrong token address");

        // get underlying token amount for 1 liquid staked token scaled by 1e18
        uint256 underlyingAmount = getUnderlyingAmount();

        // price is scaled 1e18 (oracle returns 36 - asset decimal scale)
        uint256 underlyingUSDPrice = RESILIENT_ORACLE.getPrice(UNDERLYING_TOKEN);

        // underlyingAmount (for 1 liquid staked token) * underlyingUSDPrice / 1e18
        return (underlyingAmount * underlyingUSDPrice) / EXP_SCALE;
    }

    /**
     * @notice Gets the underlying amount for liquid staked token
     * @return underlyingAmount Amount of underlying token
     */
    function getUnderlyingAmount() internal virtual view returns (uint256);
}