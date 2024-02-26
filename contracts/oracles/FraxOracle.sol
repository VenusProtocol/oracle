// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { IStakedFrax } from "../interfaces/IStakedFrax.sol";
import { ISfraxETH } from "../interfaces/ISfraxETH.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title FraxOracle
 * @author Venus
 * @notice This oracle fetches the price of sFrax and sfrxETH assets
 */
contract FraxOracle is OracleInterface {
    /// @notice Address of StakedFrax
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IStakedFrax public immutable STAKED_FRAX;

    /// @notice Address of sfraxETH
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IStakedFrax public immutable sfraxETH;

    /// @notice Address of FRAX
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable FRAX;

    /// @notice Address of sFrax
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable sFRAX;

    /// @notice Address of Resilient Oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    OracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Address of WETH (on Ethereum chain) or ETH (on BNB chain)
    address public immutable ETH;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address stakedFrax, address frax, address sFrax, address eth, address _sfraxETH, address resilientOracleAddress) {
        ensureNonzeroAddress(stakedFrax);
        ensureNonzeroAddress(frax);
        ensureNonzeroAddress(sFrax);
        ensureNonzeroAddress(eth);
        ensureNonzeroAddress(_sfraxETH);
        ensureNonzeroAddress(resilientOracleAddress);
        STAKED_FRAX = IStakedFrax(stakedFrax);
        FRAX = frax;
        sFRAX = sFrax;
        ETH = eth;
        sfraxETH = IStakedFrax(_sfraxETH);
        RESILIENT_ORACLE = OracleInterface(resilientOracleAddress);
    }

    /**
     * @notice Gets the price of sFrax or sfrxETH asset
     * @param asset Address of sFrax or sfrxETH
     * @return price Price in USD scaled by 1e18
     */
    function getPrice(address asset) public view returns (uint256) {
        if (asset != sFRAX && asset != address(sfraxETH)) revert("wrong sFRAX or sfraxETH asset address");

        uint256 assetPriceInUSD;
        if (asset == sFRAX) {
            assetPriceInUSD = RESILIENT_ORACLE.getPrice(FRAX);
        } else {
            assetPriceInUSD = RESILIENT_ORACLE.getPrice(ETH);
        }

        // get FRAX or ETH amount for 1 sFrax or sfraxETH scaled by 1e18
        uint256 amount;
        if (asset == sFRAX) {
            amount = STAKED_FRAX.convertToAssets(EXP_SCALE);
        } else {
            amount = sfraxETH.convertToAssets(EXP_SCALE);
        }

        // FRAX or ETH amount (for 1 sFRAX or 1sfraxETH) * usdPrice (of FRAX or ETH) / 1e18
        return (amount * assetPriceInUSD) / EXP_SCALE;
    }
}
