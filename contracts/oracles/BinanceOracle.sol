// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/VBep20Interface.sol";
import "../interfaces/SIDRegistryInterface.sol";
import "../interfaces/FeedRegistryInterface.sol";
import "../interfaces/PublicResolverInterface.sol";
import "../interfaces/OracleInterface.sol";
import "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import "../interfaces/OracleInterface.sol";

/**
 * @title BinanceOracle
 * @author Venus
 * @notice This oracle fetches price of assets from Binance.
 */
contract BinanceOracle is AccessControlledV8, OracleInterface {
    address public sidRegistryAddress;

    /// @notice Set this as asset address for BNB. This is the underlying address for vBNB
    address public constant BNB_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice Quote address for USD
    address public constant USD_ADDR = 0x0000000000000000000000000000000000000348;

    /// @notice Address of WBNB contract
    address public immutable WBNB;

    /// @notice Max stale period configuration for assets
    mapping(string => uint256) public maxStalePeriod;

    event MaxStalePeriodAdded(string indexed asset, uint256 maxStalePeriod);

    modifier notNullAddress(address someone) {
        if (someone == address(0)) revert("can't be zero address");
        _;
    }

    /// @notice Constructor for the implementation contract. Sets immutable variables.
    /// @param wBnbAddress The address of the WBNB
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address wBnbAddress) notNullAddress(wBnbAddress) {
        WBNB = wBnbAddress;
        _disableInitializers();
    }

    /**
     * @notice Used to set the max stale period of an asset
     * @param symbol The symbol of the asset
     * @param _maxStalePeriod The max stake period
     */
    function setMaxStalePeriod(string memory symbol, uint256 _maxStalePeriod) external {
        _checkAccessAllowed("setMaxStalePeriod(string,uint256)");
        if (_maxStalePeriod == 0) revert("stale period can't be zero");
        if (bytes(symbol).length == 0) revert("symbol cannot be empty");

        maxStalePeriod[symbol] = _maxStalePeriod;
        emit MaxStalePeriodAdded(symbol, _maxStalePeriod);
    }

    /**
     * @notice Sets the contracts required to fetch prices
     * @param _sidRegistryAddress Address of SID registry
     * @param _accessControlManager Address of the access control manager contract
     */
    function initialize(
        address _sidRegistryAddress,
        address _accessControlManager
    ) external reinitializer(2) {
        sidRegistryAddress = _sidRegistryAddress;
        __AccessControlled_init(_accessControlManager);
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
     * @notice Gets the price of a asset from the binance oracle
     * @param asset Address of the address
     * @return Price in USD
     */
    function getPrice(address asset) public view returns (uint256) {
        string memory symbol;
        uint256 decimals;

        if (asset == BNB_ADDR) {
            symbol = "WBNB";
            decimals = 18;
            asset = WBNB;
        } else {
            IERC20Metadata token = IERC20Metadata(asset);
            symbol = token.symbol();
            decimals = token.decimals();
        }

        return _getPrice(asset, symbol, decimals);
    }

    function _getPrice(address asset, string memory symbol, uint256 decimals) internal view returns (uint256) {
        FeedRegistryInterface feedRegistry = FeedRegistryInterface(getFeedRegistryAddress());

        (, int256 answer, , uint256 updatedAt, ) = feedRegistry.latestRoundData(asset, USD_ADDR);
        if (answer <= 0) revert("invalid binance oracle price");
        if (block.timestamp < updatedAt) revert("updatedAt exceeds block time");

        uint256 deltaTime = block.timestamp - updatedAt;
        if (deltaTime > maxStalePeriod[symbol]) revert("binance oracle price expired");

        uint256 decimalDelta = feedRegistry.decimals(asset, USD_ADDR);
        return (uint256(answer) * (10 ** (18 - decimalDelta))) * (10 ** (18 - decimals));
    }

    /**
     * @notice Used to compare if two strings are equal or not
     * @param str1 The first string
     * @param str2 The second string
     * @return equal Returns true if both are equal or else false.
     */
    function compare(string memory str1, string memory str2) private pure returns (bool) {
        return keccak256(bytes(str1)) == keccak256(bytes(str2));
    }
}
