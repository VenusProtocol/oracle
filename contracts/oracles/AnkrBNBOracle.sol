// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IAnkrBNB } from "../interfaces/IAnkrBNB.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title AnkrBNBOracle
 * @author Venus
 * @notice This oracle fetches the price of ankrBNB asset
 */
contract AnkrBNBOracle is CorrelatedTokenOracle {
    /// @notice This is used as token address of BNB on BSC
    address public constant NATIVE_TOKEN_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address ankrBNB,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 snapshotInterval
    )
        CorrelatedTokenOracle(
            ankrBNB,
            NATIVE_TOKEN_ADDR,
            resilientOracle,
            annualGrowthRate,
            snapshotInterval
        )
    {}

    /**
     * @notice Fetches the amount of BNB for 1 ankrBNB
     * @return amount The amount of BNB for ankrBNB
     */
    function _getUnderlyingAmount() internal view override returns (uint256) {
        return IAnkrBNB(CORRELATED_TOKEN).sharesToBonds(EXP_SCALE);
    }
}
