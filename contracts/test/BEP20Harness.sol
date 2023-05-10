// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BEP20Harness is ERC20 {
    uint8 public decimalsInternal = 18;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        decimalsInternal = decimals_;
    }

    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return decimalsInternal;
    }
}
