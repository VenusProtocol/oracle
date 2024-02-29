// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { IWBETH } from "../interfaces/IWBETH.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";
import { LiquidStakedTokenOracle } from "./common/LiquidStakedTokenOracle.sol";

/**
 * @title WBETHOracle
 * @author Venus
 * @notice This oracle fetches the price of wBETH asset
 */
contract WBETHOracle is LiquidStakedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address wbeth, 
        address eth, 
        address resilientOracle
    ) LiquidStakedTokenOracle(wbeth, eth, resilientOracle) {}

    /**
     * @notice Fetches the amount of ETH for 1 wBETH
     * @return amount The amount of ETH for wBETH 
     */
    function getUnderlyingAmount() internal view override returns (uint256) {
        return  IWBETH(LIQUID_STAKED_TOKEN).exchangeRate();
    }
}
