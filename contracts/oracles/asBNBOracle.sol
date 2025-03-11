// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IAsBNB } from "../interfaces/IAsBNB.sol";
import { IAsBNBMinter } from "../interfaces/IAsBNBMinter.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";

/**
 * @title asBNBOracle
 * @author Venus
 * @notice This oracle fetches the price of asBNB asset
 */
contract asBNBOracle is CorrelatedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address asBNB,
        address slisBNB,
        address resilientOracle
    ) CorrelatedTokenOracle(asBNB, slisBNB, resilientOracle) {}

    /**
     * @notice Fetches the amount of slisBNB for 1 asBNB
     * @return price The amount of slisBNB for asBNB
     */
    function _getUnderlyingAmount() internal view override returns (uint256) {
        IAsBNBMinter minter = IAsBNBMinter(IAsBNB(CORRELATED_TOKEN).minter());
        return minter.convertToTokens(EXP_SCALE);
    }
}
