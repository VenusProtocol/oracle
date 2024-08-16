// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import "../interfaces/IAccountantWithRateProviders.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockAccountantWithRateProviders is IAccountantWithRateProviders, Ownable {
    /// @notice The amount of WETH per LRT
    uint256 public rate;

    constructor() Ownable() {}
    
    function setRate(uint256 _rate) external onlyOwner {
        rate = _rate;
    }
    function getRate() external view returns (uint256) {
        return rate;
    }
}
