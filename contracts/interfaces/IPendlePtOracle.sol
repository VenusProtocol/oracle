// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

interface IPendlePtOracle {
    function getPtToAssetRate(address market, uint32 duration) external view returns (uint256);
}
