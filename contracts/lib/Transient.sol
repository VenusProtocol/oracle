// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

library Transient {
    /// Slot to cache the asset's price, used for transient storage
    bytes32 public constant CACHE_SLOT = keccak256(abi.encode("venus-protocol/oracle/ResilientOracle/cache"));

    /**
     * @notice Cache the asset price into transient storage
     * @param key address of the asset
     * @param value asset price
     */
    function cachePrice(address key, uint256 value) internal {
        bytes32 slot = keccak256(abi.encode(CACHE_SLOT, key));
        assembly ("memory-safe") {
            tstore(slot, value)
        }
    }

    /**
     * @notice Read cached price from transient storage
     * @param key address of the asset
     * @return value cached asset price
     */
    function readCachedPrice(address key) internal view returns (uint256 value) {
        bytes32 slot = keccak256(abi.encode(CACHE_SLOT, key));
        assembly ("memory-safe") {
            value := tload(slot)
        }
    }
}
