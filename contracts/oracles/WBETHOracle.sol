// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { IWBETH } from "../interfaces/IWBETH.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title WBETHOracle
 * @author Venus
 * @notice This oracle fetches the price of wBETH asset
 */
contract WBETHOracle is OracleInterface {
    /// @notice Address of wBETH
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable wBETH;

    /// @notice Address of Resilient Oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    OracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Address of ETH
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable ETH;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address wbeth, address eth, address resilientOracleAddress) {
        ensureNonzeroAddress(wbeth);
        ensureNonzeroAddress(resilientOracleAddress);
        ensureNonzeroAddress(eth);
        wBETH = wbeth;
        ETH = eth;
        RESILIENT_ORACLE = OracleInterface(resilientOracleAddress);
    }

    /**
     * @notice Gets the price of wBETH asset
     * @param asset Address of wBETH
     * @return price Price in USD scaled by 1e18
     */
    function getPrice(address asset) public view returns (uint256) {
        if (asset != wBETH) revert("wrong wBETH address");

        // get ETH amount for 1 wBETH scaled by 1e18
        uint256 ethAmount = IWBETH(wBETH).exchangeRate();

        // price is scaled 1e18 (oracle returns 36 - asset decimal scale)
        uint256 ethUSDPrice = RESILIENT_ORACLE.getPrice(ETH);

        // ethAmount (for 1 wBETH) * ethUSDPrice / 1e18
        return (ethAmount * ethUSDPrice) / EXP_SCALE;
    }
}
