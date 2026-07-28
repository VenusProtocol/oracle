// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

import { ITokenizedStock } from "../interfaces/ITokenizedStock.sol";
import { ChainlinkOracle } from "./ChainlinkOracle.sol";

/**
 * @title TokenizedStockOracle
 * @author Venus
 * @notice Oracle for tokenized stock tokens that implement the ERC-8056 scaled UI amount extension.
 *         For an asset flagged as a tokenized stock, the configured feed reports the price per share
 *         (the UI price of the underlying equity) and `getPrice` scales it by the token's UI multiplier
 *         to obtain the price per raw token, which is the denomination Venus values raw balances in.
 *         Assets that are not flagged are priced exactly as `ChainlinkOracle` prices them.
 * @dev Assets are configured with the inherited `setTokenConfig`; the tokenized stock flag is set
 *      separately with `setIsTokenizedStock`. Feed staleness, positivity and decimal normalisation are
 *      all handled by `ChainlinkOracle.getPrice`.
 */
contract TokenizedStockOracle is ChainlinkOracle {
    /// @notice Whether an asset's price must be scaled by its ERC-8056 UI multiplier
    mapping(address => bool) public isTokenizedStock;

    /// @notice Emitted when the tokenized stock flag of an asset is updated
    event IsTokenizedStockUpdated(address indexed asset, bool oldValue, bool newValue);

    /// @notice Thrown if the multiplier reported by a tokenized stock is zero
    error InvalidMultiplier();

    /**
     * @notice Sets whether an asset is a tokenized stock whose price must be scaled by its UI multiplier
     * @param asset Asset address, which can't be a null address
     * @param isTokenizedStock_ True if the asset is a tokenized stock, false to price it as a plain feed
     * @custom:access Only Governance
     * @custom:error NotNullAddress error is thrown if the asset address is null
     * @custom:event Emits IsTokenizedStockUpdated event on successfully updating the flag
     */
    function setIsTokenizedStock(address asset, bool isTokenizedStock_) external notNullAddress(asset) {
        _checkAccessAllowed("setIsTokenizedStock(address,bool)");

        emit IsTokenizedStockUpdated(asset, isTokenizedStock[asset], isTokenizedStock_);
        isTokenizedStock[asset] = isTokenizedStock_;
    }

    /**
     * @inheritdoc ChainlinkOracle
     * @dev Returns the feed price unchanged unless the asset is flagged as a tokenized stock, in which
     *      case the price per share is scaled by the asset's UI multiplier.
     * @custom:error InvalidMultiplier is thrown if a tokenized stock reports a zero multiplier
     */
    function getPrice(address asset) public view override returns (uint256) {
        uint256 price = super.getPrice(asset);

        // Return `price` as ChainlinkOracle computed it, already normalised to the asset's decimals, when
        // a price was set manually or when the asset is not a tokenized stock
        if (prices[asset] != 0 || !isTokenizedStock[asset]) return price;

        uint256 multiplier = ITokenizedStock(asset).uiMultiplier();
        if (multiplier == 0) revert InvalidMultiplier();

        return (price * multiplier) / EXP_SCALE;
    }
}
