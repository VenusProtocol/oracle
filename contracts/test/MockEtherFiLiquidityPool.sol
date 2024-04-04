// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "../interfaces/IEtherFiLiquidityPool.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockEtherFiLiquidityPool is IEtherFiLiquidityPool, Ownable {
    /// @notice The amount of eETH per weETH scaled by 1e18
    uint256 public amountPerShare;

    constructor() Ownable() {}

    function setAmountPerShare(uint256 _amountPerShare) external onlyOwner {
        amountPerShare = _amountPerShare;
    }

    function amountForShare(uint256 _share) external view override returns (uint256) {
        return (_share * amountPerShare) / 1e18;
    }
}
