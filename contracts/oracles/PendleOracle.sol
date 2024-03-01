// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { IPendlePtOracle } from "../interfaces/IPendlePtOracle.sol";
import { LiquidStakedTokenOracle } from "./common/LiquidStakedTokenOracle.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

/**
 * @title PendleOracle
 * @author Venus
 * @notice This oracle fetches the price of an pendle token
 */
contract PendleOracle is LiquidStakedTokenOracle {
    /// @notice Address of the PT oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IPendlePtOracle public immutable PT_ORACLE;

    /// @notice Address of the market
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable MARKET;

    /// @notice Twap duration for the oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint32 public immutable TWAP_DURATION;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address market,
        address ptOracle,
        address ptToken,
        address underlyingToken,
        address resilientOracle,
        uint32 twapDuration
    ) LiquidStakedTokenOracle(ptToken, underlyingToken, resilientOracle) {
        ensureNonzeroAddress(market);
        ensureNonzeroAddress(ptOracle);
        ensureNonzeroValue(twapDuration);

        MARKET = market;
        PT_ORACLE = IPendlePtOracle(ptOracle);
        TWAP_DURATION = twapDuration;
    }

    /**
     * @notice Fetches the amount of FRAX for 1 sFrax
     * @return amount The amount of FRAX for sFrax
     */
    function getUnderlyingAmount() internal view override returns (uint256) {
        return PT_ORACLE.getPtToAssetRate(MARKET, TWAP_DURATION);
    }
}
