// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

interface ICappedOracle {
    function updateSnapshot() external;
}
