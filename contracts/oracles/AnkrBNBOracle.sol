// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { IAnkrBNB } from "../interfaces/IAnkrBNB.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";
import { LiquidStakedTokenOracle } from "./common/LiquidStakedTokenOracle.sol";

/**
 * @title AnkrBNBOracle
 * @author Venus
 * @notice This oracle fetches the price of ankrBNB asset
 */
contract AnkrBNBOracle is LiquidStakedTokenOracle {

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address _ankrBNB, 
        address _bnb,
        address _resilientOracleAddress
    ) LiquidStakedTokenOracle(_ankrBNB, _bnb, _resilientOracleAddress) {}

    /**
     * @notice Fetches the amount of BNB for ankrBNB
     * @param liquidStakedAmount Amount of ankrBNB
     * @return price The amount of BNB for ankrBNB 
     */
    function getUnderlyingAmount(uint256 liquidStakedAmount) internal view override returns (uint256) {
        return IAnkrBNB(LIQUID_STAKED_TOKEN).sharesToBonds(liquidStakedAmount);
    }
}
