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
    OracleInterface public immutable INTERMEDIATE_ORACLE;

    /// @notice Constructor for the implementation contract.
    constructor(
        address correlatedToken,
        address underlyingToken,
        address resilientOracle,
        address intermediateOracle,
        uint256 annualGrowthRate,
        uint256 _snapshotInterval,
        uint256 initialSnapshotExchangeRate,
        uint256 initialSnapshotTimestamp,
        address accessControlManager,
        uint256 _snapshotGap
    )
        CorrelatedTokenOracle(
            correlatedToken,
            underlyingToken,
            resilientOracle,
            annualGrowthRate,
            _snapshotInterval,
            initialSnapshotExchangeRate,
            initialSnapshotTimestamp,
            accessControlManager,
            _snapshotGap
        )
    {
        ensureNonzeroAddress(intermediateOracle);
        INTERMEDIATE_ORACLE = OracleInterface(intermediateOracle);
    }

    /**
     * @notice Fetches the amount of the underlying token for 1 correlated token, using the intermediate oracle
     * @return amount The amount of the underlying token for 1 correlated token scaled by the underlying token decimals
     */
    function getUnderlyingAmount() public view override returns (uint256) {
        uint256 underlyingDecimals = IERC20Metadata(UNDERLYING_TOKEN).decimals();
        uint256 correlatedDecimals = IERC20Metadata(CORRELATED_TOKEN).decimals();

        uint256 underlyingAmount = INTERMEDIATE_ORACLE.getPrice(CORRELATED_TOKEN);

        return (underlyingAmount * (10 ** correlatedDecimals)) / (10 ** (36 - underlyingDecimals));
    }
}
