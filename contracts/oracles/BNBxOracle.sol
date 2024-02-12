// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { IStaderStakerManager } from "../interfaces/IStaderStakeManager.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title BNBxOracle
 * @author Venus
 * @notice This oracle fetches the price of BNBx asset
 */
contract BNBxOracle is OracleInterface {
    /// @notice Address of StakeManager
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IStaderStakerManager public immutable STAKE_MANAGER;

    /// @notice Address of BNBx
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable BNBX;

    /// @notice Address of Resilient Oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    OracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Set this as asset address for native token on each chain.
    address public constant NATIVE_TOKEN_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address stakeManager, address bnbx, address resilientOracleAddress) {
        ensureNonzeroAddress(stakeManager);
        ensureNonzeroAddress(bnbx);
        ensureNonzeroAddress(resilientOracleAddress);
        STAKE_MANAGER = IStaderStakerManager(stakeManager);
        BNBX = bnbx;
        RESILIENT_ORACLE = OracleInterface(resilientOracleAddress);
    }

    /**
     * @notice Gets the price of BNBx asset
     * @param asset Address of BNBx
     * @return price Price in USD scaled by 1e18
     */
    function getPrice(address asset) public view returns (uint256) {
        if (asset != BNBX) revert("wrong BNBx address");

        // get BNB amount for 1 BNBx scaled by 1e18
        uint256 BNBAmount = STAKE_MANAGER.convertBnbXToBnb(1 ether);

        // price is scaled 1e18 (oracle returns 36 - asset decimal scale)
        uint256 bnbUSDPrice = RESILIENT_ORACLE.getPrice(NATIVE_TOKEN_ADDR);

        // BNBAmount (for 1 BNBx) * bnbUSDPrice / 1e18
        return (BNBAmount * bnbUSDPrice) / EXP_SCALE;
    }
}