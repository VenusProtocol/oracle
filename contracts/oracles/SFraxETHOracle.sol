// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { ISFrax } from "../interfaces/ISFrax.sol";
import { ISfraxETH } from "../interfaces/ISfraxETH.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title SFraxETHOracle
 * @author Venus
 * @notice This oracle fetches the price of sfrxETH
 */
contract SFraxETHOracle is OracleInterface {
    /// @notice A flag assuming 1:1 price equivalence between frxETH/ETH
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    bool public immutable ASSUME_FRXETH_ETH_EQUIVALENCE;

    /// @notice Address of sfraxETH
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    ISfraxETH public immutable sfraxETH;

    /// @notice Address of fraxETH
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable fraxETH;

    /// @notice Address of Resilient Oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    OracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Address of WETH (on Ethereum chain) or ETH (on BNB chain)
    address public immutable ETH;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address _eth,
        address _sfraxETH,
        address _fraxETH,
        address _resilientOracleAddress,
        bool _assumeEquivalence
    ) {
        ensureNonzeroAddress(_eth);
        ensureNonzeroAddress(_sfraxETH);
        ensureNonzeroAddress(_fraxETH);
        ensureNonzeroAddress(_resilientOracleAddress);
        ETH = _eth;
        sfraxETH = ISfraxETH(_sfraxETH);
        fraxETH = _fraxETH;
        RESILIENT_ORACLE = OracleInterface(_resilientOracleAddress);
        ASSUME_FRXETH_ETH_EQUIVALENCE = _assumeEquivalence;
    }

    /**
     * @notice Gets the price of sFrax or sfrxETH asset
     * @param asset Address of sFrax or sfrxETH
     * @return price Price in USD scaled by 1e18
     */
    function getPrice(address asset) public view returns (uint256) {
        if (asset != address(sfraxETH)) revert("wrong token address");

        uint256 assetPriceInUSD = RESILIENT_ORACLE.getPrice(ASSUME_FRXETH_ETH_EQUIVALENCE ? ETH : address(fraxETH));

        // get FRAX or ETH amount for 1 sFrax or sfraxETH scaled by 1e18
        uint256 amount = sfraxETH.convertToAssets(EXP_SCALE);

        // FRAX or ETH amount (for 1 sFRAX or 1sfraxETH) * usdPrice (of FRAX or ETH) / 1e18
        return (amount * assetPriceInUSD) / EXP_SCALE;
    }
}
