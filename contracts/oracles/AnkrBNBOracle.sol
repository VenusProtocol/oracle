// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { IAnkrBNB } from "../interfaces/IAnkrBNB.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title AnkrBNBOracle
 * @author Venus
 * @notice This oracle fetches the price of ankrBNB asset
 */
contract AnkrBNBOracle is OracleInterface {
    /// @notice Address of ankrBNB
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable ankrBNB;

    /// @notice Address of Resilient Oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    OracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Set this as asset address for native token on each chain.
    address public constant NATIVE_TOKEN_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _ankrBNB, address resilientOracleAddress) {
        ensureNonzeroAddress(_ankrBNB);
        ensureNonzeroAddress(resilientOracleAddress);
        ankrBNB = _ankrBNB;
        RESILIENT_ORACLE = OracleInterface(resilientOracleAddress);
    }

    /**
     * @notice Gets the price of ankrBNB asset
     * @param asset Address of ankrBNB
     * @return price Price in USD scaled by 1e18
     */
    function getPrice(address asset) public view returns (uint256) {
        if (asset != ankrBNB) revert("wrong ankrBNB address");

        // get BNB amount for 1 ankrBNB scaled by 1e18
        uint256 bnbAmount = IAnkrBNB(ankrBNB).sharesToBonds(1 ether);

        // price is scaled 1e18 (oracle returns 36 - asset decimal scale)
        uint256 bnbUSDPrice = RESILIENT_ORACLE.getPrice(NATIVE_TOKEN_ADDR);

        // bnbAmount (for 1 ankrBNB) * bnbUSDPrice / 1e18
        return (bnbAmount * bnbUSDPrice) / EXP_SCALE;
    }
}
