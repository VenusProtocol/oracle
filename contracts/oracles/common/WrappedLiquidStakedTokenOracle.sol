// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { OracleInterface } from "../../interfaces/OracleInterface.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title WrappedLiquidStakedTokenOracle
 * @author Venus
 * @notice This oracle fetches the price of wrapped liquid staked tokens
 */
abstract contract WrappedLiquidStakedTokenOracle is OracleInterface {
    /// @notice A flag assuming 1:1 price equivalence between rebasing token and underlying token
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    bool public immutable ASSUME_EQUIVALENCE;

    /// @notice Address of rebasing staked token
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable REBASE_TOKEN;

    /// @notice Address of wrapped token obtained from rebasing rebasing token
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable WRAPPED_TOKEN;

    /// @notice Address of Resilient Oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    OracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Address of WETH (on Ethereum chain) or ETH (on BNB chain)
    address public immutable UNDERLYING_TOKEN;

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address _underlyingToken,
        address _rebaseToken,
        address _wrappedToken,
        address _resilientOracle,
        bool _assumeEquivalence
    ) {
        ensureNonzeroAddress(_underlyingToken);
        ensureNonzeroAddress(_rebaseToken);
        ensureNonzeroAddress(_wrappedToken);
        ensureNonzeroAddress(_resilientOracle);
        UNDERLYING_TOKEN = _underlyingToken;
        REBASE_TOKEN = _rebaseToken;
        WRAPPED_TOKEN = _wrappedToken;
        RESILIENT_ORACLE = OracleInterface(_resilientOracle);
        ASSUME_EQUIVALENCE = _assumeEquivalence;
    }

    /**
     * @notice Gets the price of wrapped liquid staked token
     * @param asset Address of wrapped liquid staked token
     * @return price Price in USD scaled by 1e18
     */
    function getPrice(address asset) public view returns (uint256) {
        if (asset != address(WRAPPED_TOKEN)) revert("wrong token address");

        // get rebase token amount for 1 wrapped token
        uint256 amount = getRebaseTokenAmount();

        uint256 assetPriceInUSD = RESILIENT_ORACLE.getPrice(ASSUME_EQUIVALENCE ? UNDERLYING_TOKEN : REBASE_TOKEN);

        // FRAX or ETH amount (for 1 sFRAX or 1sfrxETH) * usdPrice (of FRAX or ETH) / 1e18
        return (amount * assetPriceInUSD) / EXP_SCALE;
    }

    /**
     * @notice Gets the reabse token amount for wrapped liquid staked token
     * @return amount Amount of rebase token
     */
    function getRebaseTokenAmount() internal view virtual returns (uint256);
}
