// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { IAnkrBNB } from "../interfaces/IAnkrBNB.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";

/**
 * @title AnkrBNBOracle
 * @author Venus
 * @notice This oracle fetches the price of ankrBNB asset
 */
contract AnkrBNBOracle is CorrelatedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address _ankrBNB,
        address _bnb,
        address _resilientOracle
    ) CorrelatedTokenOracle(_ankrBNB, _bnb, _resilientOracle) {}

    /**
     * @notice Fetches the amount of BNB for 1 ankrBNB
     * @return amount The amount of BNB for ankrBNB
     */
    function getUnderlyingAmount() internal view override returns (uint256) {
        return IAnkrBNB(CORRELATED_TOKEN).sharesToBonds(1 ether);
    }
}
