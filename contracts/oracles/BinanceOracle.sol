// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/core/Initializable.sol";
import "../interfaces/OracleInterface.sol";

contract BinanceOracle is OracleInterface, Initializable {
    
    function initialize() initializer {

    }

    function getUnderlyingPrice(address vToken) external view override returns (uint256) {
        return 0;
    }
}