// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IAsBNB } from "../interfaces/IAsBNB.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockAsBNB is ERC20, Ownable, IAsBNB {
    uint8 private immutable _decimals;
    address public minter;

    constructor(string memory name_, string memory symbol_, uint8 decimals_, address minter_) ERC20(name_, symbol_) Ownable() {
        _decimals = decimals_;
        minter = minter_;
    }

    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function setMinter(address minter_) external onlyOwner {
        minter = minter_;
    }

    function decimals() public view virtual override(ERC20, IAsBNB) returns (uint8) {
        return _decimals;
    }
}
