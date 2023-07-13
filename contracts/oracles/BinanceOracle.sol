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

    /// @notice Max stale period configuration for assets
    mapping(string => uint256) public maxStalePeriod;

    /// @notice Override symbols to be compatible with Binance feed registry
    mapping(string => string) public symbols;

    event MaxStalePeriodAdded(string indexed asset, uint256 maxStalePeriod);

    event SymbolOverridden(string symbol, string indexed overriddenSymbol);

    /**
     * @notice Checks whether an address is null or not
     */
    modifier notNullAddress(address someone) {
        if (someone == address(0)) revert("can't be zero address");
        _;
    }

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
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
     * @notice Used to override a symbol when fetching price
     * @param symbol The symbol to override
     * @param overrideSymbol The symbol after override
     */
    function setSymbolOverride(string calldata symbol, string calldata overrideSymbol) external {
        _checkAccessAllowed("setSymbolOverride(string,string)");
        if (bytes(symbol).length == 0) revert("symbol cannot be empty");

        symbols[symbol] = overrideSymbol;
        emit SymbolOverridden(symbol, overrideSymbol);
    }

    /**
     * @notice Sets the contracts required to fetch prices
     * @param _sidRegistryAddress Address of SID registry
     * @param _accessControlManager Address of the access control manager contract
     */
    function initialize(
        address _sidRegistryAddress,
        address _accessControlManager
    ) external initializer notNullAddress(_sidRegistryAddress) {
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
     * @param asset Address of the asset
     * @return Price in USD
     */
    function getPrice(address asset) public view returns (uint256) {
        string memory symbol;
        uint256 decimals;

        if (asset == BNB_ADDR) {
            symbol = "BNB";
            decimals = 18;
        } else {
            IERC20Metadata token = IERC20Metadata(asset);
            symbol = token.symbol();
            decimals = token.decimals();
        }

        string storage overrideSymbol = symbols[symbol];

        if (bytes(overrideSymbol).length != 0) {
            symbol = overrideSymbol;
        }

        return _getPrice(symbol, decimals);
    }

    function _getPrice(string calldata symbol, uint256 decimals) internal view returns (uint256) {
        FeedRegistryInterface feedRegistry = FeedRegistryInterface(getFeedRegistryAddress());

        (, int256 answer, , uint256 updatedAt, ) = feedRegistry.latestRoundDataByName(symbol, "USD");
        if (answer <= 0) revert("invalid binance oracle price");
        if (block.timestamp < updatedAt) revert("updatedAt exceeds block time");

        uint256 deltaTime;
        unchecked {
            deltaTime = block.timestamp - updatedAt;
        }
        if (deltaTime > maxStalePeriod[symbol]) revert("binance oracle price expired");

        uint256 decimalDelta = feedRegistry.decimalsByName(symbol, "USD");
        return (uint256(answer) * (10 ** (18 - decimalDelta))) * (10 ** (18 - decimals));
    }
}
