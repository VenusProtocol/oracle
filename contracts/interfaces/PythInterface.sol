// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

contract PythStructs {
    //
    // The confidence interval roughly corresponds to the standard error of a normal distribution.
    // Both the price and confidence are stored in a fixed-point numeric representation,
    // `x * (10^expo)`, where `expo` is the exponent.
    //
    // Please refer to the documentation at https://docs.pyth.network/consumers/best-practices for how
    // to how this price safely.
    struct Price {
        // Price
        int64 price;
        // Confidence interval around the price
        uint64 conf;
        // Price exponent
        int32 expo;
    }

    // PriceFeed represents a current aggregate price from pyth publisher feeds.
    struct PriceFeed {
        // The price ID.
        bytes32 id;
        // Product account key.
        bytes32 productId;
        // The current price.
        int64 price;
        // Confidence interval around the price.
        uint64 conf;
        // Price exponent.
        int32 expo;
        // Status of price.
        PriceStatus status;
        // Maximum number of allowed publishers that can contribute to a price.
        uint32 maxNumPublishers;
        // Number of publishers that made up current aggregate.
        uint32 numPublishers;
        // Exponentially moving average price.
        int64 emaPrice;
        // Exponentially moving average confidence interval.
        uint64 emaConf;
        // Unix timestamp describing when the price was published
        uint64 publishTime;
        // Price of previous price with TRADING status
        int64 prevPrice;
        // Confidence interval of previous price with TRADING status
        uint64 prevConf;
        // Unix timestamp describing when the previous price with TRADING status was published
        uint64 prevPublishTime;
    }

    /* PriceStatus represents the availability status of a price feed.
        UNKNOWN: The price feed is not currently updating for an unknown reason.
        TRADING: The price feed is updating as expected.
        HALTED: The price feed is not currently updating because trading in the product has been halted.
        AUCTION: The price feed is not currently updating because an auction is setting the price.
    */
    enum PriceStatus {
        UNKNOWN,
        TRADING,
        HALTED,
        AUCTION
    }

}

/// @title Consume prices from the Pyth Network (https://pyth.network/).
/// @author Pyth Data Association
interface IPyth {
    /// @dev Emitted when an update for price feed with `id` is processed successfully.
    /// @param id The Pyth Price Feed ID.
    /// @param fresh True if the price update is more recent and stored.
    /// @param chainId ID of the source chain that the batch price update containing this price.
    /// This value comes from Wormhole, and you can find the corresponding chains at https://docs.wormholenetwork.com/wormhole/contracts.
    /// @param sequenceNumber Sequence number of the batch price update containing this price.
    /// @param lastPublishTime Publish time of the previously stored price.
    /// @param publishTime Publish time of the given price update.
    /// @param price Current price of the given price update.
    /// @param conf Current confidence interval of the given price update.
    event PriceFeedUpdate(bytes32 indexed id, bool indexed fresh, uint16 chainId, uint64 sequenceNumber, uint64 lastPublishTime, uint64 publishTime, int64 price, uint64 conf);

    /// @dev Emitted when a batch price update is processed successfully.
    /// @param chainId ID of the source chain that the batch price update comes from.
    /// @param sequenceNumber Sequence number of the batch price update.
    /// @param batchSize Number of prices within the batch price update.
    /// @param freshPricesInBatch Number of prices that were more recent and were stored.
    event BatchPriceFeedUpdate(uint16 chainId, uint64 sequenceNumber, uint batchSize, uint freshPricesInBatch);

    /// @dev Emitted when a call to `updatePriceFeeds` is processed successfully.
    /// @param sender Sender of the call (`msg.sender`).
    /// @param batchCount Number of batches that this function processed.
    /// @param fee Amount of paid fee for updating the prices.
    event UpdatePriceFeeds(address indexed sender, uint batchCount, uint fee);

    /// @notice Returns the current price and confidence interval.
    /// @dev Reverts if the current price is not available.
    /// @param id The Pyth Price Feed ID of which to fetch the current price and confidence interval.
    /// @return price - please read the documentation of PythStructs.Price to understand how to use this safely.
    function getCurrentPrice(bytes32 id) external view returns (PythStructs.Price memory price);

    /// @notice Returns the exponential moving average price and confidence interval.
    /// @dev Reverts if the current exponential moving average price is not available.
    /// @param id The Pyth Price Feed ID of which to fetch the current price and confidence interval.
    /// @return price - please read the documentation of PythStructs.Price to understand how to use this safely.
    function getEmaPrice(bytes32 id) external view returns (PythStructs.Price memory price);

    /// @notice Returns the latest available price, along with the timestamp when it was generated.
    /// @dev This function returns the same price as `getCurrentPrice` in the case where a price was available
    /// at the time this `PriceFeed` was published (`publish_time`). However, if a price was not available
    /// at that time, this function returns the price from the latest time at which the price was available.
    ///
    /// The returned price can be from arbitrarily far in the past; this function makes no guarantees that
    /// the returned price is recent or useful for any particular application.
    ///
    /// Users of this function should check the returned timestamp to ensure that the returned price is
    /// sufficiently recent for their application. If you are considering using this function, it may be
    /// safer / easier to use either `getCurrentPrice` or `getLatestAvailablePriceWithinDuration`.
    /// @return price - please read the documentation of PythStructs.Price to understand how to use this safely.
    /// @return publishTime - the UNIX timestamp of when this price was computed.
    function getLatestAvailablePriceUnsafe(bytes32 id) external view returns (PythStructs.Price memory price, uint64 publishTime);

    /// @notice Returns the latest price as long as it was updated within `duration` seconds of the current time.
    /// @dev This function is a sanity-checked version of `getLatestAvailablePriceUnchecked` which is useful in
    /// applications that require a sufficiently-recent price. Reverts if the price wasn't updated sufficiently
    /// recently.
    function getLatestAvailablePriceWithinDuration(bytes32 id, uint64 duration) external view returns (PythStructs.Price memory price);

    /// @notice Update price feeds with given update messages.
    /// This method requires the caller to pay a fee in wei; the required fee can be computed by calling
    /// `getUpdateFee` with the length of the `updateData` array.
    /// Prices will be updated if they are more recent than the current stored prices.
    /// The call will succeed even if the update is not the most recent.
    /// @dev Reverts if the transferred fee is not sufficient or the updateData is invalid.
    /// @param updateData Array of price update data.
    function updatePriceFeeds(bytes[] memory updateData) external payable;

    /// @notice Wrapper around updatePriceFeeds that rejects fast if a price update is not necessary. A price update is
    /// necessary if the current on-chain publishTime is older than the given publishTime. It relies solely on the
    /// given `publishTimes` for the price feeds and does not read the actual price update publish time within `updateData`.
    ///
    /// This method requires the caller to pay a fee in wei; the required fee can be computed by calling
    /// `getUpdateFee` with the length of the `updateData` array.
    ///
    /// `priceIds` and `publishTimes` are two arrays with the same size that correspond to senders known publishTime
    /// of each priceId when calling this method. If all of price feeds within `priceIds` have updated and have
    /// a newer or equal publish time than the given publish time, it will reject the transaction to save gas.
    /// Otherwise, it calls updatePriceFeeds method to update the prices.
    ///
    /// @dev Reverts if update is not needed or the transferred fee is not sufficient or the updateData is invalid.
    /// @param updateData Array of price update data.
    /// @param priceIds Array of price ids.
    /// @param publishTimes Array of publishTimes. `publishTimes[i]` corresponds to known `publishTime` of `priceIds[i]`
    function updatePriceFeedsIfNecessary(bytes[] memory updateData, bytes32[] memory priceIds, uint64[] memory publishTimes) external payable;

    /// @notice Returns the required fee to update an array of price updates.
    /// @param updateDataSize Number of price updates.
    /// @return feeAmount The required fee in Wei.
    function getUpdateFee(uint updateDataSize) external view returns (uint feeAmount);
}