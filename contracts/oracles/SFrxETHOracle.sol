// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";
import { ISfrxEthFraxOracle } from "../interfaces/ISfrxEthFraxOracle.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title SFrxETHOracle
 * @author Venus
 * @notice This oracle fetches the price of sfrxETH
 */
contract SFrxETHOracle is CorrelatedTokenOracle {
    /// @notice Address of SfrxEthFraxOracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    ISfrxEthFraxOracle public immutable SFRXETH_FRAX_ORACLE;

    /// @notice Thrown if the price data is invalid
    error BadPriceData();

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address sfrxEthFraxOracle,
        address sfrxETH,
        address frax,
        address resilientOracle
    ) CorrelatedTokenOracle(sfrxETH, frax, resilientOracle) {
        ensureNonzeroAddress(sfrxEthFraxOracle);
        SFRXETH_FRAX_ORACLE = ISfrxEthFraxOracle(sfrxEthFraxOracle);
    }

    /**
     * @notice Gets the FRAX for 1 sfrxETH
     * @return amount Amount of FRAX
     */
    function _getUnderlyingAmount() internal view override returns (uint256) {
        (bool isBadData, uint256 priceLow, uint256 priceHigh) = SFRXETH_FRAX_ORACLE.getPrices();

        if (isBadData) revert BadPriceData();
        
        // calculate average price
        uint256 averagePrice = (priceLow + priceHigh) / 2;

        // return (1 / averagePrice) as the average price is in sfraxETH
        return (EXP_SCALE ** 2) / averagePrice;
    }
}
