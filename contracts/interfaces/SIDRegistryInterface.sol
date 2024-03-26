// SPDX-License-Identifier: BSD-3-Clause
// SPDX-FileCopyrightText: 2022 Venus
pragma solidity ^0.8.20;

interface SIDRegistryInterface {
    function resolver(bytes32 node) external view returns (address);
}
