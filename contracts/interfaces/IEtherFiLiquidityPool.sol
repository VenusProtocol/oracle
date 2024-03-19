// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

interface IEtherFiLiquidityPool {
    function amountForShare(uint256 _share) external view returns (uint256);
}
