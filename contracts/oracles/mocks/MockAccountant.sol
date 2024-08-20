// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import "../../interfaces/IAccountant.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockAccountant is IAccountant, Ownable {
    uint256 public rate;

    constructor() Ownable() {}

    function setRate(uint256 _rate) external onlyOwner {
        rate = _rate;
    }

    function getRateSafe() external view override returns (uint256) {
        return rate;
    }
}
