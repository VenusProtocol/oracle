// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "../../interfaces/FeedRegistryInterface.sol";

contract MockBinanceFeedRegistry is FeedRegistryInterface {
    mapping(address => uint256) public assetPrices;

    function setAssetPrice(address base, uint256 price) external {
        assetPrices[base] = price;
    }

    function latestRoundData(
        address base,
        address quote
    )
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        quote;
        return (0, int256(assetPrices[base]), 0, block.timestamp - 10, 0);
    }

    function decimals(address base, address quote) external view override returns (uint8) {
        return 8;
    }
}
