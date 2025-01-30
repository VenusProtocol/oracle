// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol, uint8 decimals) ERC20(name, symbol) {
        _mint(msg.sender, 100000 * 10 ** uint256(decimals));
    }
}
