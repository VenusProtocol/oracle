// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.13;

abstract contract PriceOracle {
    /**
     * @notice Get the underlying price of a vToken asset
     * @param vToken The vToken address to get the underlying price of
     * @return The underlying asset price mantissa (scaled by 1e18).
     *  Zero means the price is unavailable.
     */
    function getUnderlyingPrice(address vToken) external view virtual returns (uint256);

    function updatePrice(address vToken) external virtual;
}
