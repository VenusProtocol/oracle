// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../interfaces/VBep20Interface.sol";
import "../interfaces/AggregatorV2V3Interface.sol";

contract ChainlinkOracle {
    using SafeMath for uint256;
    uint256 public constant VAI_VALUE = 1e18;
    address public admin;

    mapping(address => uint256) internal prices;
    mapping(address => uint256) internal maxStalePeriods;
    mapping(address => AggregatorV2V3Interface) internal feeds;

    event PricePosted(
        address asset,
        uint256 previousPriceMantissa,
        uint256 requestedPriceMantissa,
        uint256 newPriceMantissa
    );
    event NewAdmin(address oldAdmin, address newAdmin);
    event FeedSet(address feed, address asset, uint256 maxStalePeriod);

    constructor() {
        admin = msg.sender;
    }

    function getUnderlyingPrice(VBep20Interface vToken) public view returns (uint256) {
        string memory symbol = vToken.symbol();
        // VBNB token doesn't have `underlying` method 
        if (compareStrings(symbol, "vBNB")) {
            return getChainlinkPrice(getFeed(address(vToken)));
        // VAI price is constantly 1
        } else if (compareStrings(symbol, "VAI")) {
            return VAI_VALUE;
        // @todo: This is some history code, keep it here in case of messing up 
        } else if (compareStrings(symbol, "XVS")) {
            return prices[address(vToken)];
        } else {
            return getUnderlyingPriceInternal(vToken);
        }
    }

    function getUnderlyingPriceInternal(VBep20Interface vToken) internal view returns (uint256 price) {
        VBep20Interface token = VBep20Interface(vToken.underlying());

        if (prices[address(token)] != 0) {
            price = prices[address(token)];
        } else {
            price = getChainlinkPrice(getFeed(address(vToken)));
        }

        uint256 decimalDelta = uint256(18).sub(uint256(token.decimals()));
        // Ensure that we don't multiply the result by 0
        if (decimalDelta > 0) {
            return price.mul(10**decimalDelta);
        } else {
            return price;
        }
    }

    function getChainlinkPrice(AggregatorV2V3Interface feed) internal view returns (uint256) {
        // Chainlink USD-denominated feeds store answers at 8 decimals
        uint256 decimalDelta = uint256(18).sub(feed.decimals());

        (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();

        // a feed with 0 max stale period or doesn't exist, return 0
        uint256 maxStalePeriod = maxStalePeriods[address(feed)];
        if (maxStalePeriod == 0) {
            return 0;
        }

        // Ensure that we don't multiply the result by 0
        if (block.timestamp.sub(updatedAt, "updatedAt exceeds block time") > maxStalePeriod) {
            return 0;
        }

        if (decimalDelta > 0) {
            return uint256(answer).mul(10**decimalDelta);
        } else {
            return uint256(answer);
        }
    }

    function setUnderlyingPrice(VBep20Interface vToken, uint256 underlyingPriceMantissa) external onlyAdmin {
        address asset = address(vToken.underlying());
        emit PricePosted(asset, prices[asset], underlyingPriceMantissa, underlyingPriceMantissa);
        prices[asset] = underlyingPriceMantissa;
    }

    function setDirectPrice(address asset, uint256 price) external onlyAdmin {
        emit PricePosted(asset, prices[asset], price, price);
        prices[asset] = price;
    }

    function batchSetFeeds(
        address[] calldata assets_,
        address[] calldata feeds_,
        uint256[] calldata maxStalePeriods_
    ) external onlyAdmin {
        require(assets_.length == feeds_.length, "invalid length");
        require(assets_.length == maxStalePeriods_.length, "invalid length");
        require(assets_.length > 0, "empty feeds");
        for (uint256 i = 0; i < assets_.length; i++) {
            setFeed(assets_[i], feeds_[i], maxStalePeriods_[i]);
        }
    }

    function setFeed(address asset, address feed, uint256 maxStalePeriod) public onlyAdmin {
        require(feed != address(0) && feed != address(this), "invalid feed address");
        require(maxStalePeriod > 0, "stale period can't be zero");
        feeds[asset] = AggregatorV2V3Interface(feed);
        maxStalePeriods[feed] = maxStalePeriod;
        emit FeedSet(feed, asset, maxStalePeriod);
    }

    function getFeed(address vToken) public view returns (AggregatorV2V3Interface) {
        return feeds[vToken];
    }

    function getMaxStalePeriod(address feed) external view returns (uint256) {
        return maxStalePeriods[feed];
    }

    function assetPrices(address asset) external view returns (uint256) {
        return prices[asset];
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        address oldAdmin = admin;
        admin = newAdmin;

        emit NewAdmin(oldAdmin, newAdmin);
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin may call");
        _;
    }
}
