// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

interface IAsBNB {
    function minter() external view returns (address);
    function decimals() external view returns (uint8);
}
