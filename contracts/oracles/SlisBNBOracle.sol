// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { ISynclubStakeManager } from "../interfaces/ISynclubStakeManager.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";
import { LiquidStakedTokenOracle } from "./common/LiquidStakedTokenOracle.sol";

/**
 * @title SlisBNBOracle
 * @author Venus
 * @notice This oracle fetches the price of slisBNB asset
 */
contract SlisBNBOracle is LiquidStakedTokenOracle {
    /// @notice Address of StakeManager
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    ISynclubStakeManager public immutable STAKE_MANAGER;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address _stakeManager, 
        address _slisBNB, 
        address _bnb,
        address _resilientOracle
    ) LiquidStakedTokenOracle(_slisBNB, _bnb, _resilientOracle) {
        ensureNonzeroAddress(_stakeManager);
        STAKE_MANAGER = ISynclubStakeManager(_stakeManager);
    }

    /**
     * @notice Fetches the amount of BNB for 1 slisBNB
     * @return amount The amount of BNB for slisBNB
     */
    function getUnderlyingAmount() internal view override returns (uint256) {
        return STAKE_MANAGER.convertSnBnbToBnb(1 ether);
    }
}
