// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title OneJumpOracle
 * @author Venus
 * @notice This oracle fetches the price of an asset in through an intermediate asset
 */
contract OneJumpOracle is CorrelatedTokenOracle {
    /// @notice Address of the intermediate oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    OracleInterface public immutable INTERMEDIATE_ORACLE;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address correlatedToken,
        address underlyingToken,
        address resilientOracle,
        address intermediateOracle
    ) CorrelatedTokenOracle(correlatedToken, underlyingToken, resilientOracle) {
        ensureNonzeroAddress(intermediateOracle);
        INTERMEDIATE_ORACLE = OracleInterface(intermediateOracle);
    }

    /**
     * @notice Fetches the amount of the underlying token for 1 correlated token, using the intermediate oracle
     * @return amount The amount of the underlying token for 1 correlated token, using the intermediate oracle
     */
    function _getUnderlyingAmount() internal view override returns (uint256) {
        uint256 underlyingDecimals = IERC20Metadata(UNDERLYING_TOKEN).decimals();
        uint256 correlatedDecimals = IERC20Metadata(CORRELATED_TOKEN).decimals();

        uint256 underlyingAmount = INTERMEDIATE_ORACLE.getPrice(CORRELATED_TOKEN);

        return (underlyingAmount * (10 ** correlatedDecimals)) / (10 ** (36 - underlyingDecimals));
    }
}
