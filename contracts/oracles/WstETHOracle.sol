// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { IStETH } from "../interfaces/IStETH.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title WstETHOracle
 * @author Venus
 * @notice Depending on the equivalence flag price is either based on assumption that 1 stETH = 1 ETH
 *         or the price of stETH/USD (secondary market price) is obtained from the oracle.
 */
contract WstETHOracle is OracleInterface {
    /// @notice A flag assuming 1:1 price equivalence between stETH/ETH
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    bool public immutable ASSUME_STETH_ETH_EQUIVALENCE;

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
    constructor(
        address wstETHAddress,
        address wETHAddress,
        address stETHAddress,
        address resilientOracleAddress,
        bool assumeEquivalence
    ) {
        ensureNonzeroAddress(wstETHAddress);
        ensureNonzeroAddress(wETHAddress);
        ensureNonzeroAddress(stETHAddress);
        ensureNonzeroAddress(resilientOracleAddress);
        WSTETH_ADDRESS = wstETHAddress;
        WETH_ADDRESS = wETHAddress;
        STETH = IStETH(stETHAddress);
        RESILIENT_ORACLE = OracleInterface(resilientOracleAddress);
        ASSUME_STETH_ETH_EQUIVALENCE = assumeEquivalence;
    }

    /**
     * @notice Gets the USD price of wstETH asset
     * @dev Depending on the equivalence flag price is either based on assumption that 1 stETH = 1 ETH
     *      or the price of stETH/USD (secondary market price) is obtained from the oracle
     * @param asset Address of wstETH
     * @return wstETH Price in USD scaled by 1e18
     */
    function getPrice(address asset) public view returns (uint256) {
        if (asset != WSTETH_ADDRESS) revert("wrong wstETH address");

        // get stETH amount for 1 wstETH scaled by 1e18
        uint256 stETHAmount = STETH.getPooledEthByShares(1 ether);

        // price is scaled 1e18 (oracle returns 36 - asset decimal scale)
        uint256 stETHUSDPrice = RESILIENT_ORACLE.getPrice(ASSUME_STETH_ETH_EQUIVALENCE ? WETH_ADDRESS : address(STETH));

        // stETHAmount (for 1 wstETH) * stETHUSDPrice / 1e18
        return (stETHAmount * stETHUSDPrice) / EXP_SCALE;
    }
}
