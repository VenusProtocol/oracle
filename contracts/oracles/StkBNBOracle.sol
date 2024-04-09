// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { IPStakePool } from "../interfaces/IPStakePool.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";

/**
 * @title StkBNBOracle
 * @author Venus
 * @notice This oracle fetches the price of stkBNB asset
 */
contract StkBNBOracle is CorrelatedTokenOracle {
    /// @notice This is used as token address of BNB on BSC
    address public constant NATIVE_TOKEN_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice Address of StakePool
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IPStakePool public immutable STAKE_POOL;

    /// @notice Thrown if the pool token supply is zero
    error PoolTokenSupplyIsZero();

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address stakePool,
        address stkBNB,
        address resilientOracle
    ) CorrelatedTokenOracle(stkBNB, NATIVE_TOKEN_ADDR, resilientOracle) {
        ensureNonzeroAddress(stakePool);
        STAKE_POOL = IPStakePool(stakePool);
    }

    /**
     * @notice Fetches the amount of BNB for 1 stkBNB
     * @return price The amount of BNB for stkBNB
     */
    function getUnderlyingAmount() internal view override returns (uint256) {
        IPStakePool.Data memory exchangeRateData = STAKE_POOL.exchangeRate();

        if (exchangeRateData.poolTokenSupply == 0) {
            revert PoolTokenSupplyIsZero();
        }

        return (exchangeRateData.totalWei * EXP_SCALE) / exchangeRateData.poolTokenSupply;
    }
}
