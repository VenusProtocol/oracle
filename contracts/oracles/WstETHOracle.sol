// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { IStETH } from "../interfaces/IStETH.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";
import { WrappedLiquidStakedTokenOracle } from "./common/WrappedLiquidStakedTokenOracle.sol";

/**
 * @title WstETHOracle
 * @author Venus
 * @notice Depending on the equivalence flag price is either based on assumption that 1 stETH = 1 ETH
 *         or the price of stETH/USD (secondary market price) is obtained from the oracle.
 */
contract WstETHOracle is WrappedLiquidStakedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address wETHAddress,
        address stETHAddress,
        address wstETHAddress,
        address resilientOracleAddress,
        bool assumeEquivalence
    )
        WrappedLiquidStakedTokenOracle(
            wETHAddress,
            stETHAddress,
            wstETHAddress,
            resilientOracleAddress,
            assumeEquivalence
        )
    {}

    /**
     * @notice Gets the stETH for 1 wstETH
     * @return amount Amount of stETH
     */
    function getRebaseTokenAmount() internal view override returns (uint256) {
        return IStETH(REBASE_TOKEN).getPooledEthByShares(1 ether);
    }
}
