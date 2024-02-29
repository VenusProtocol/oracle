// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { IStaderStakeManager } from "../interfaces/IStaderStakeManager.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";
import { LiquidStakedTokenOracle } from "./common/LiquidStakedTokenOracle.sol";

/**
 * @title BNBxOracle
 * @author Venus
 * @notice This oracle fetches the price of BNBx asset
 */
contract BNBxOracle is LiquidStakedTokenOracle {
    /// @notice Address of StakeManager
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IStaderStakeManager public immutable STAKE_MANAGER;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address stakeManager,
        address bnbx,
        address bnb,
        address resilientOracle
    ) LiquidStakedTokenOracle(bnbx, bnb, resilientOracle) {
        ensureNonzeroAddress(stakeManager);
        STAKE_MANAGER = IStaderStakeManager(stakeManager);
    }

    /**
     * @notice Fetches the amount of BNB for 1 BNBx
     * @return price The amount of BNB for BNBx
     */
    function getUnderlyingAmount() internal view override returns (uint256) {
        return STAKE_MANAGER.convertBnbXToBnb(1 ether);
    }
}
