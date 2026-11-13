// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IStork } from "../interfaces/IStork.sol";

/**
 * @title StorkChainlinkAdapter
 * @author Venus
 * @notice Exposes one Stork feed through the Chainlink `latestRoundData` interface, so the ChainlinkOracle can read it
 * @dev Stork stores the update time in nanoseconds. The ChainlinkOracle compares `updatedAt` with `block.timestamp`,
 *      so it is reported here in seconds; in nanoseconds every read reverts with "updatedAt exceeds block time".
 *
 *      The value is read through Stork's own age check, which reverts once the value is older than Stork's
 *      `validTimePeriodSeconds` (1 hour on BNB Chain). An hourly feed can pass that age shortly before a push lands,
 *      and every price read reverts until it does. A `maxStalePeriod` on the ChainlinkOracle only binds when it is
 *      set below Stork's limit.
 */
contract StorkChainlinkAdapter {
    /// @notice Stork contract that stores the feed
    IStork public immutable STORK;

    /// @notice Stork ID of the feed this adapter reads
    bytes32 public immutable PRICE_ID;

    /**
     * @param stork Stork contract address
     * @param priceId Stork ID of the feed
     */
    constructor(IStork stork, bytes32 priceId) {
        // Reverts for a zero address, a non-Stork contract, an ID that was never pushed or a value older than
        // Stork's age limit, so a bad feed fails at deploy instead of on the first price read.
        stork.getTemporalNumericValueV1(priceId);

        STORK = stork;
        PRICE_ID = priceId;
    }

    /**
     * @notice Latest value of the feed, with `startedAt` and `updatedAt` in seconds
     * @dev Stork keeps no rounds, so `roundId` and `answeredInRound` carry the update time.
     */
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        IStork.TemporalNumericValue memory value = STORK.getTemporalNumericValueV1(PRICE_ID);
        updatedAt = value.timestampNs / 1e9;
        return (uint80(updatedAt), value.quantizedValue, updatedAt, updatedAt, uint80(updatedAt));
    }

    /// @notice Stork stores every value with 18 decimals
    function decimals() external pure returns (uint8) {
        return 18;
    }
}
