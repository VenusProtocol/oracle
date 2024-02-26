// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { IWeETH } from "../interfaces/IWeETH.sol";
import { IEETH } from "../interfaces/IEETH.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title EtherFiOracle
 * @author Venus
 * @notice This oracle fetches the price of eETH and weETH assets
 */
contract EtherFiOracle is OracleInterface {
    /// @notice Address of weETH
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IWeETH public immutable weETH;

    /// @notice Address of eETH
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IEETH public immutable eETH;

    /// @notice Address of Resilient Oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    OracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Set this as asset address for native token on each chain.
    address public constant NATIVE_TOKEN_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _weETH, address _eETH, address resilientOracleAddress) {
        ensureNonzeroAddress(_weETH);
        ensureNonzeroAddress(_eETH);
        ensureNonzeroAddress(resilientOracleAddress);
        weETH = IWeETH(_weETH);
        eETH = IEETH(_eETH);
        RESILIENT_ORACLE = OracleInterface(resilientOracleAddress);
    }

    /**
     * @notice Gets the price of eETH or weETH asset
     * @param asset Address of eETH or weETH
     * @return price Price in USD scaled by 1e18
     */
    function getPrice(address asset) public view returns (uint256) {
        if (asset != address(eETH) && asset != address(weETH)) revert("wrong eETH or weETH asset address");

        uint256 eETHAmount;

        if (asset == address(eETH)) {
            eETHAmount = EXP_SCALE;
        } else {
            eETHAmount = weETH.getEETHByWeETH(EXP_SCALE);
        }

        // Calculate ETH amount for 1 eETH or weETH scaled by 1e18
        uint256 ethAmount = (eETH.totalShares() / EXP_SCALE) * eETH.totalSupply();
        ethAmount = (ethAmount * eETHAmount) / EXP_SCALE;

        uint256 ethUSDPrice = RESILIENT_ORACLE.getPrice(NATIVE_TOKEN_ADDR);

        // ETH amount (for 1 weETH or eETH) * usdPrice (of ETH) / 1e18
        return (ethAmount * ethUSDPrice) / EXP_SCALE;
    }
}
