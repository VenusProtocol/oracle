// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

interface IZkETH {
    function LSTPerToken() external view returns (uint256);
    function decimals() external view returns (uint8);
}
