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
    IStaderStakeManager public immutable STAKE_MANAGER;

    /// @notice Constructor for the implementation contract.
    constructor(
        address stakeManager,
        address bnbx,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 _snapshotInterval,
        uint256 initialSnapshotExchangeRate,
        uint256 initialSnapshotTimestamp,
        address accessControlManager,
        uint256 _snapshotGap
    )
        CorrelatedTokenOracle(
            bnbx,
            NATIVE_TOKEN_ADDR,
            resilientOracle,
            annualGrowthRate,
            _snapshotInterval,
            initialSnapshotExchangeRate,
            initialSnapshotTimestamp,
            accessControlManager,
            _snapshotGap
        )
    {
        ensureNonzeroAddress(stakeManager);
        STAKE_MANAGER = IStaderStakeManager(stakeManager);
    }

    /**
     * @notice Fetches the amount of BNB for 1 BNBx
     * @return price The amount of BNB for BNBx
     */
    function getUnderlyingAmount() public view override returns (uint256) {
        return STAKE_MANAGER.convertBnbXToBnb(EXP_SCALE);
    }
}
