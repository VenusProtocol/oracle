// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

interface FeedRegistryInterface {
    function latestRoundData(
        address base,
        address quote
    )
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);

    function decimals(address base, address quote) external view returns (uint8);
}
