// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

interface IStork {
    struct TemporalNumericValue {
        // Time of the value, in nanoseconds
        uint64 timestampNs;
        // The value, with 18 decimals
        int192 quantizedValue;
    }

    function getTemporalNumericValueV1(bytes32 id) external view returns (TemporalNumericValue memory value);
}
