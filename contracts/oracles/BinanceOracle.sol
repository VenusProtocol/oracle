// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/VBep20Interface.sol";
import "../interfaces/SIDRegistryInterface.sol";
import "../interfaces/FeedRegistryInterface.sol";
import "../interfaces/PublicResolverInterface.sol";
import "../interfaces/OracleInterface.sol";
import "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";

/**
 * @title BinanceOracle
 * @author Venus
 * @notice This oracle fetches price of assets from Binance.
 */
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
        if (bytes(symbol).length == 0) revert("symbol cannot be empty");

        maxStalePeriod[symbol] = _maxStalePeriod;
        emit MaxStalePeriodAdded(symbol, _maxStalePeriod);
    }

    /**
     * @notice Sets the contracts required to fetch prices
     * @param _sidRegistryAddress Address of SID registry
     * @param _accessControlManager Address of the access control manager contract
     */
    function initialize(address _sidRegistryAddress, address _accessControlManager) external initializer {
        sidRegistryAddress = _sidRegistryAddress;
        __AccessControlled_init(_accessControlManager);
    }

    /**
     * @notice Gets the price of a vToken from the binance oracle
     * @param vToken Address of the vToken
     * @return Price in USD
     */
    function getUnderlyingPrice(address vToken) external view override returns (uint256) {
        string memory symbol;
        uint256 decimals;

        // VBNB token doesn't have `underlying` method
        if (vToken == vBnb) {
            symbol = "BNB";
            decimals = 18;
        } else if (vToken == vai) {
            symbol = "VAI";
            decimals = 18;
        } else {
            IERC20Metadata underlyingToken = IERC20Metadata(VBep20Interface(vToken).underlying());
            symbol = underlyingToken.symbol();
            decimals = underlyingToken.decimals();
        }

        if (compare(symbol, "WBNB")) {
            symbol = "BNB";
        }

        if (compare(symbol, "wBETH")) {
            symbol = "WBETH";
        }

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
     * @notice Used to compare if two strings are equal or not
     * @param str1 The first string
     * @param str2 The second string
     * @return equal Returns true if both are equal or else false.
     */
    function compare(string memory str1, string memory str2) private pure returns (bool) {
        return keccak256(bytes(str1)) == keccak256(bytes(str2));
    }
}
