// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../interfaces/FeedRegistryInterface.sol";
import "../interfaces/VBep20Interface.sol";
import "../interfaces/BEP20Interface.sol";

contract BinanceOracle is Initializable {

    FeedRegistryInterface public feedRegistry;
    
    function initialize(FeedRegistryInterface feed) public initializer {
        feedRegistry = feed;
    }

    function getUnderlyingPrice(VBep20Interface vToken) public view returns (uint256) {
        BEP20Interface underlyingToken = BEP20Interface(vToken.underlying());
        (,int256 answer,,,) = feedRegistry.latestRoundDataByName(underlyingToken.symbol(), "USD");

        //price is returned in 8 decimal places
        return uint256(answer);
    }
}