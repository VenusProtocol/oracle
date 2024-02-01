// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { IStETH } from "../interfaces/IStETH.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title WstETHOracle
 * @author Venus
 * @notice This oracle returns the USD price of wstETH asset
 */
contract WstETHOracle is OracleInterface {
    /// @notice Address of stETH
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IStETH public immutable STETH;

    /// @notice Address of wstETH
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable WSTETH_ADDRESS;

    /// @notice Address of WETH
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable WETH_ADDRESS;

    /// @notice Address of Resilient Oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    OracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address wstETHAddress, address wETHAddress, address stETHAddress, address resilientOracleAddress) {
        ensureNonzeroAddress(wstETHAddress);
        ensureNonzeroAddress(wETHAddress);
        ensureNonzeroAddress(stETHAddress);
        ensureNonzeroAddress(resilientOracleAddress);
        WSTETH_ADDRESS = wstETHAddress;
        WETH_ADDRESS = wETHAddress;
        STETH = IStETH(stETHAddress);
        RESILIENT_ORACLE = OracleInterface(resilientOracleAddress);
    }

    /**
     * @notice Gets the USD price of wstETH asset
     * @dev Price is based on assumption that 1 stETH = 1 ETH
     * @param asset Address of wstETH
     * @return wstETH Price in USD scaled by 1e18
     */
    function getPrice(address asset) public view returns (uint256) {
        if (asset != WSTETH_ADDRESS) revert("wrong wstETH address");

        // get stETH amount for 1 wstETH scaled by 1e18
        uint256 stETHAmount = STETH.getPooledEthByShares(1 ether);

        // price is scaled 1e18 (oracle returns 36 - asset decimal scale)
        uint256 wethUSDPrice = RESILIENT_ORACLE.getPrice(WETH_ADDRESS);

        // stETHAmount (for 1 wstETH) * wethUSDPrice (assuming 1stETH = 1 WETH) / 1e18
        return (stETHAmount * wethUSDPrice) / EXP_SCALE;
    }
}
