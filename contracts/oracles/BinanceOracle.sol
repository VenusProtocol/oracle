// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/VBep20Interface.sol";
import "../interfaces/SIDRegistryInterface.sol";
import "../interfaces/FeedRegistryInterface.sol";
import "../interfaces/PublicResolverInterface.sol";

contract BinanceOracle is Initializable {
    address public sidRegistryAddress;

    /// @notice vBNB address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vBnb;

    /// @notice VAI address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vai;

    /// @notice Constructor for the implementation contract. Sets immutable variables.
    /// @param vBnbAddress The address of the vBNB
    /// @param vaiAddress The address of the VAI
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address vBnbAddress, address vaiAddress) {
        if (vBnbAddress == address(0)) revert("vBNB can't be zero address");
        if (vaiAddress == address(0)) revert("VAI can't be zero address");
        vBnb = vBnbAddress;
        vai = vaiAddress;
        _disableInitializers();
    }

    /**
     * @notice Sets the contracts required to fetch prices
     * @param _sidRegistryAddress Address of SID registry
     */
    function initialize(address _sidRegistryAddress) public initializer {
        sidRegistryAddress = _sidRegistryAddress;
    }

    /**
     * @notice Uses Space ID to fetch the feed registry address
     * @return feedRegistryAddress Address of binance oracle feed registry.
     */
    function getFeedRegistryAddress() public view returns (address) {
        bytes32 nodeHash = 0x94fe3821e0768eb35012484db4df61890f9a6ca5bfa984ef8ff717e73139faff;

        SIDRegistryInterface sidRegistry = SIDRegistryInterface(sidRegistryAddress);
        address publicResolverAddress = sidRegistry.resolver(nodeHash);
        PublicResolverInterface publicResolver = PublicResolverInterface(publicResolverAddress);

        return publicResolver.addr(nodeHash);
    }

    /**
     * @notice Gets the price of a vToken from the binance oracle
     * @param vToken Address of the vToken
     * @return Price in USD
     */
    function getUnderlyingPrice(VBep20Interface vToken) public view returns (uint256) {
        string memory symbol;
        uint256 decimals;

        // VBNB token doesn't have `underlying` method
        if (address(vToken) == vBnb) {
            symbol = "BNB";
            decimals = 18;
        } else if (address(vToken) == vai) {
            symbol = "VAI";
            decimals = 18;
        } else {
            IERC20Metadata underlyingToken = IERC20Metadata(vToken.underlying());
            symbol = underlyingToken.symbol();
            decimals = underlyingToken.decimals();
        }

        if (keccak256(bytes(symbol)) == keccak256(bytes("WBNB"))) {
            symbol = "BNB";
        }

        FeedRegistryInterface feedRegistry = FeedRegistryInterface(getFeedRegistryAddress());

        (, int256 answer, , , ) = feedRegistry.latestRoundDataByName(symbol, "USD");
        if (answer <= 0) revert("invalid binance oracle price");

        uint256 decimalDelta = feedRegistry.decimalsByName(symbol, "USD");
        return (uint256(answer) * (10 ** (18 - decimalDelta))) * (10 ** (18 - decimals));
    }
}
