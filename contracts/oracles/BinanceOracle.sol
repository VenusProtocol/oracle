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

        try feedRegistry.latestRoundDataByName(underlyingToken.symbol(), "USD") returns (uint80,int256 answer,uint256,uint256,uint80) {
            //price is returned in 18 decimal places
            uint decimalDelta = feedRegistry.decimalsByName(underlyingToken.symbol(), "USD");
            return (uint256(answer) * (10 ** (18 - decimalDelta)));
        } catch Error(string memory) {
            return 0;
        }
    }
}