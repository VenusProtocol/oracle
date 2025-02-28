// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IStaderStakeManager } from "../interfaces/IStaderStakeManager.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";
import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";

/**
 * @title BNBxOracle
 * @author Venus
 * @notice This oracle fetches the price of BNBx asset
 */
contract BNBxOracle is CorrelatedTokenOracle {
    /// @notice This is used as token address of BNB on BSC
    address public constant NATIVE_TOKEN_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice Address of StakeManager
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IStaderStakeManager public immutable STAKE_MANAGER;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address stakeManager,
        address bnbx,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 snapshotInterval
    ) CorrelatedTokenOracle(bnbx, NATIVE_TOKEN_ADDR, resilientOracle, annualGrowthRate, snapshotInterval) {
        ensureNonzeroAddress(stakeManager);
        STAKE_MANAGER = IStaderStakeManager(stakeManager);
    }

    /**
     * @notice Fetches the amount of BNB for 1 BNBx
     * @return price The amount of BNB for BNBx
     */
    function _getUnderlyingAmount() internal view override returns (uint256) {
        return STAKE_MANAGER.convertBnbXToBnb(EXP_SCALE);
    }
}
