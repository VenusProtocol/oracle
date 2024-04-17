// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IAnkrBNB } from "../interfaces/IAnkrBNB.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockAnkrBNB is ERC20, Ownable, IAnkrBNB {
    uint8 private immutable _decimals;
    uint256 public exchangeRate;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) Ownable() {
        _decimals = decimals_;
    }

    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function setSharesToBonds(uint256 rate) external onlyOwner {
        exchangeRate = rate;
    }

    function sharesToBonds(uint256 amount) external view override returns (uint256) {
        return (amount * exchangeRate) / (10 ** uint256(_decimals));
    }

    function decimals() public view virtual override(ERC20, IAnkrBNB) returns (uint8) {
        return _decimals;
    }
}
