// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

library Transient {
    /**
     * @notice Cache the asset price into transient storage
     * @param key address of the asset
     * @param value asset price
     */
    function cachePrice(bytes32 cacheSlot, address key, uint256 value) internal {
        bytes32 slot = keccak256(abi.encode(cacheSlot, key));
        assembly ("memory-safe") {
            tstore(slot, value)
        }
    }

    /**
     * @notice Read cached price from transient storage
     * @param key address of the asset
     * @return value cached asset price
     */
    function readCachedPrice(bytes32 cacheSlot, address key) internal view returns (uint256 value) {
        bytes32 slot = keccak256(abi.encode(cacheSlot, key));
        assembly ("memory-safe") {
            value := tload(slot)
        }
    }
}
