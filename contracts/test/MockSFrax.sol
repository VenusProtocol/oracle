// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ISFrax } from "../interfaces/ISFrax.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockSFrax is ERC20, Ownable, ISFrax {
    uint8 private immutable _decimals;
    uint256 public exchangeRate;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) Ownable() {
        _decimals = decimals_;
    }

    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function setRate(uint256 rate) external onlyOwner {
        exchangeRate = rate;
    }

    function convertToAssets(uint256 shares) external view override returns (uint256) {
        return (shares * exchangeRate) / (10 ** uint256(_decimals));
    }

    function decimals() public view virtual override(ERC20, ISFrax) returns (uint8) {
        return _decimals;
    }
}
