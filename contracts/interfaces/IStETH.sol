// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.20;

interface IStETH {
    function getPooledEthByShares(uint256 _sharesAmount) external view returns (uint256);
}
