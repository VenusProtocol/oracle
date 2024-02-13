// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { IPStakePool } from "../interfaces/IPStakePool.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title StkBNBOracle
 * @author Venus
 * @notice This oracle fetches the price of stkBNB asset
 */
contract StkBNBOracle is OracleInterface {
    /// @notice Address of StakePool
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IPStakePool public immutable STAKE_POOL;

    /// @notice Address of stkBNB
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable stkBNB;

    /// @notice Address of Resilient Oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    OracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Set this as asset address for native token on each chain.
    address public constant NATIVE_TOKEN_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address stakePool, address _stkBNB, address resilientOracleAddress) {
        ensureNonzeroAddress(stakePool);
        ensureNonzeroAddress(_stkBNB);
        ensureNonzeroAddress(resilientOracleAddress);
        STAKE_POOL = IPStakePool(stakePool);
        stkBNB = _stkBNB;
        RESILIENT_ORACLE = OracleInterface(resilientOracleAddress);
    }

    /**
     * @notice Gets the price of stkBNB asset
     * @param asset Address of stkBNB
     * @return price Price in USD scaled by 1e18
     */
    function getPrice(address asset) public view returns (uint256) {
        if (asset != stkBNB) revert("wrong stkBNB address");

        // get BNB amount for 1 stkBNB scaled by 1e18
        IPStakePool.Data memory exchangeRateData = STAKE_POOL.exchangeRate();
        uint256 BNBAmount = (exchangeRateData.totalWei * EXP_SCALE) / exchangeRateData.poolTokenSupply;

        // price is scaled 1e18 (oracle returns 36 - asset decimal scale)
        uint256 bnbUSDPrice = RESILIENT_ORACLE.getPrice(NATIVE_TOKEN_ADDR);

        // BNBAmount (for 1 stkBNB) * bnbUSDPrice / 1e18
        return (BNBAmount * bnbUSDPrice) / EXP_SCALE;
    }
}
