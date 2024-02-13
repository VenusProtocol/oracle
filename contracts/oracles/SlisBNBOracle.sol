// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { ISynclubStakeManager } from "../interfaces/ISynclubStakeManager.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title SlisBNBOracle
 * @author Venus
 * @notice This oracle fetches the price of slisBNB asset
 */
contract SlisBNBOracle is OracleInterface {
    /// @notice Address of StakeManager
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    ISynclubStakeManager public immutable STAKE_MANAGER;

    /// @notice Address of slisBNB
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable slisBNB;

    /// @notice Address of Resilient Oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    OracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Set this as asset address for native token on each chain.
    address public constant NATIVE_TOKEN_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address stakeManager, address _slisBNB, address resilientOracleAddress) {
        ensureNonzeroAddress(stakeManager);
        ensureNonzeroAddress(_slisBNB);
        ensureNonzeroAddress(resilientOracleAddress);
        STAKE_MANAGER = ISynclubStakeManager(stakeManager);
        slisBNB = _slisBNB;
        RESILIENT_ORACLE = OracleInterface(resilientOracleAddress);
    }

    /**
     * @notice Gets the price of slisBNB asset
     * @param asset Address of slisBNB
     * @return price Price in USD scaled by 1e18
     */
    function getPrice(address asset) public view returns (uint256) {
        if (asset != slisBNB) revert("wrong slisBNB address");

        // get BNB amount for 1 slisBNB scaled by 1e18
        uint256 BNBAmount = STAKE_MANAGER.convertSnBnbToBnb(1 ether);

        // price is scaled 1e18 (oracle returns 36 - asset decimal scale)
        uint256 bnbUSDPrice = RESILIENT_ORACLE.getPrice(NATIVE_TOKEN_ADDR);

        // BNBAmount (for 1 slisBNB) * bnbUSDPrice / 1e18
        return (BNBAmount * bnbUSDPrice) / EXP_SCALE;
    }
}
