// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../interfaces/FeedRegistryInterface.sol";
import "../interfaces/VBep20Interface.sol";
import "../interfaces/BEP20Interface.sol";

contract BinanceOracle is Initializable {
    FeedRegistryInterface public feedRegistry;

    /// @notice vBNB address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vBnb;

    /// @notice Constructor for the implementation contract. Sets immutable variables.
    /// @param vBnbAddress The address of the VBNB
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address vBnbAddress) {
        require(vBnbAddress != address(0), "can't be zero address");
        vBnb = vBnbAddress;
        _disableInitializers();
    }

    /**
     * @notice Sets the contracts required to fetch price
     * @param feed Address of binance oracle feed registry.
     */
    function initialize(FeedRegistryInterface feed) public initializer {
        feedRegistry = feed;
    }

    /**
     * @notice Gets the price of vToken from binance oracle
     * @param vToken Address of the vToken
     * @return price in USD
     */
    function getUnderlyingPrice(VBep20Interface vToken) public view returns (uint256) {
        string memory symbol;
        uint256 decimals;

        // VBNB token doesn't have `underlying` method
        if (address(vToken) == vBnb) {
            symbol = "BNB";
            decimals = 18;
        } else {
            BEP20Interface underlyingToken = BEP20Interface(vToken.underlying());
            symbol = underlyingToken.symbol();
            decimals = underlyingToken.decimals();
        }

        if (keccak256(bytes(symbol)) == keccak256(bytes("WBNB"))) {
            symbol = "BNB";
        }

        (, int256 answer, , , ) = feedRegistry.latestRoundDataByName(symbol, "USD");

        uint256 decimalDelta = feedRegistry.decimalsByName(symbol, "USD");
        return (uint256(answer) * (10 ** (18 - decimalDelta))) * (10 ** (18 - decimals));
    }
}
