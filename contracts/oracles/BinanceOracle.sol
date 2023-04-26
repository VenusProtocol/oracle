// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/VBep20Interface.sol";
import "../interfaces/SIDRegistryInterface.sol";
import "../interfaces/FeedRegistryInterface.sol";
import "../interfaces/PublicResolverInterface.sol";
import "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import "../interfaces/OracleInterface.sol";

contract BinanceOracle is AccessControlledV8, OracleInterface {
    address public sidRegistryAddress;

    /// @notice vBNB address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vBnb;

    /// @notice VAI address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vai;

    /// @notice Max stale period configuration for assets
    mapping(string => uint256) public maxStalePeriod;

    event MaxStalePeriodAdded(string indexed asset, uint256 maxStalePeriod);

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
     * @notice Used to set the max stale period of an asset
     * @param symbol The symbol of the asset
     * @param _maxStalePeriod The max stake period
     */
    function setMaxStalePeriod(string memory symbol, uint256 _maxStalePeriod) external {
        _checkAccessAllowed("setMaxStalePeriod(string,uint256)");
        if (_maxStalePeriod == 0) revert("stale period can't be zero");
        if (compare(symbol, "")) revert("symbol cannot be empty");

        maxStalePeriod[symbol] = _maxStalePeriod;
        emit MaxStalePeriodAdded(symbol, _maxStalePeriod);
    }

    /**
     * @notice Sets the contracts required to fetch prices
     * @param _sidRegistryAddress Address of SID registry
     * @param _accessControlManager Address of the access control manager contract
     */
    function initialize(address _sidRegistryAddress, address _accessControlManager) public initializer {
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

    function _getPrice(string memory symbol, uint256 decimals) internal view returns (uint256) {
        FeedRegistryInterface feedRegistry = FeedRegistryInterface(getFeedRegistryAddress());

        (, int256 answer, , uint256 updatedAt, ) = feedRegistry.latestRoundDataByName(symbol, "USD");
        if (answer <= 0) revert("invalid binance oracle price");
        if (block.timestamp < updatedAt) revert("updatedAt exceeds block time");

        uint256 deltaTime = block.timestamp - updatedAt;
        if (deltaTime > maxStalePeriod[symbol]) revert("binance oracle price expired");

        uint256 decimalDelta = feedRegistry.decimalsByName(symbol, "USD");
        return (uint256(answer) * (10 ** (18 - decimalDelta))) * (10 ** (18 - decimals));
    }

    /**
     * @notice Gets the price of a asset from the binance oracle
     * @param asset Address of the address
     * @return Price in USD
     */
    function getPrice(address asset) public view returns (uint256) {
        IERC20Metadata token = IERC20Metadata(asset);
        string memory symbol = token.symbol();
        uint256 decimals = token.decimals();
        return _getPrice(symbol, decimals);
    }

    /**
     * @notice Used to compare if two strings are equal or not
     * @param str1 The first string
     * @param str2 The second string
     * @return equal Returns true if both are equal or else false.
     */
    function compare(string memory str1, string memory str2) internal pure returns (bool) {
        return keccak256(abi.encodePacked(str1)) == keccak256(abi.encodePacked(str2));
    }
}
