// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

interface IWeETH {
    function getEETHByWeETH(uint256 _weETHAmount) external view returns (uint256);
    function decimals() external view returns (uint8);
}
