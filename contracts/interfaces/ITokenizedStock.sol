// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

interface ITokenizedStock {
    /**
     * @notice Number of shares represented by one raw token, scaled by 1e18
     * @dev The ERC-8056 scaled UI amount multiplier. Returns the currently active value: it switches to
     *      a scheduled value on its own once that value's effective timestamp is reached.
     * @return The active multiplier, where 1e18 is 1.0
     */
    function uiMultiplier() external view returns (uint256);
}
