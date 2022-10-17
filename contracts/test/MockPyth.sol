// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../interfaces/PythInterface.sol";

contract MockPyth is IPyth {
    mapping(bytes32 => PythStructs.PriceFeed) public priceFeeds;

    function queryPriceFeed(bytes32 id) public view returns (PythStructs.PriceFeed memory priceFeed) {
        require(priceFeeds[id].id != 0, "no price feed found for the given price id");
        return priceFeeds[id];
    }

    // simply update price feeds
    function updatePriceFeedsHarness(PythStructs.PriceFeed[] calldata feeds) external {
        require(feeds.length > 0, "feeds length must > 0");
        for (uint256 i = 0; i < feeds.length; ++i) {
            priceFeeds[feeds[i].id] = feeds[i];
        }
    }

    // a very simple version get price with timestamp expiration check, just for test
    function getLatestAvailablePriceWithinDuration(bytes32 id, uint64 duration)
        external
        view
        override
        returns (PythStructs.Price memory price)
    {
        PythStructs.PriceFeed memory priceFeed = queryPriceFeed(id);

        price.price = priceFeed.price;
        price.conf = priceFeed.conf;
        price.expo = priceFeed.expo;
        uint64 publishTime = priceFeed.publishTime;

        require(_diff(block.timestamp, publishTime) <= duration, "No available price within given duration");

        return price;
    }

    function _diff(uint256 x, uint256 y) internal pure returns (uint256) {
        if (x > y) {
            return x - y;
        } else {
            return y - x;
        }
    }

    // not implemented
    function updatePriceFeedsIfNecessary(
        bytes[] memory updateData,
        bytes32[] memory priceIds,
        uint64[] memory publishTimes
    ) external payable {
        updateData;
        priceIds;
        publishTimes;
    }

    function getUpdateFee(uint256 updateDataSize) external pure override returns (uint256 feeAmount) {
        updateDataSize;
        return 0;
    }

    function updatePriceFeeds(bytes[] memory updateData) external payable {
        updateData;
    }

    function getCurrentPrice(bytes32 id) external pure override returns (PythStructs.Price memory price) {
        id;
        return PythStructs.Price({ price: 0, conf: 0, expo: 0 });
    }

    function getEmaPrice(bytes32 id) external pure override returns (PythStructs.Price memory price) {
        id;
        return PythStructs.Price({ price: 0, conf: 0, expo: 0 });
    }

    function getLatestAvailablePriceUnsafe(bytes32 id)
        external
        pure
        override
        returns (PythStructs.Price memory price, uint64 publishTime)
    {
        id;
        return (PythStructs.Price({ price: 0, conf: 0, expo: 0 }), 0);
    }
}
