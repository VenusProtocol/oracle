// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

interface ISFrax {
    function convertToAssets(uint256 shares) external view returns (uint256);
    function decimals() external view returns (uint8);
}
