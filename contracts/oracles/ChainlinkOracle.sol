// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.13;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../interfaces/VBep20Interface.sol";
import "../interfaces/OracleInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV2V3Interface.sol";

struct TokenConfig {
    /// @notice underlying token address, which can't be zero address and can be used for existance check
    /// @notice 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB for BNB
    address asset;
    /// @notice chainlink feed address
    address feed;
    /// @notice expiration period of this asset
    uint256 maxStalePeriod;
}

contract ChainlinkOracle is OwnableUpgradeable, OracleInterface {
    /// @notice VAI token is considered $1 constantly in oracle for now
    uint256 public constant VAI_VALUE = 1e18;

    /// @notice vBNB address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vBnb;

    /// @notice Set this as asset address for BNB. This is the underlying for vBNB
    address public constant BNB_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice Enables us to force set the prices to certain values in some urgent conditions
    mapping(address => uint256) public prices;

    /// @notice token config by assets
    mapping(address => TokenConfig) public tokenConfigs;

    /// @notice emit when forced price is set
    event PricePosted(
        address asset,
        uint256 previousPriceMantissa,
        uint256 requestedPriceMantissa,
        uint256 newPriceMantissa
    );

    /// @notice emit when token config is added
    event TokenConfigAdded(address asset, address feed, uint256 maxStalePeriod);

    modifier notNullAddress(address someone) {
        require(someone != address(0), "can't be zero address");
        _;
    }

    /// @notice Constructor for the implementation contract. Sets immutable variables.
    /// @param vBnbAddress The address of the VBNB
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address vBnbAddress) notNullAddress(vBnbAddress) {
        vBnb = vBnbAddress;
        _disableInitializers();
    }

    /// @notice Initializes the owner of the contract
    function initialize() public initializer {
        __Ownable_init();
    }

    /**
     * @notice Get the Chainlink price of underlying asset of input vToken, revert when vToken is zero address
     * @param vToken vToken address
     * @return price in USD
     */
    function getUnderlyingPrice(address vToken) public view override returns (uint256) {
        string memory symbol = address(vToken) != vBnb ? VBep20Interface(vToken).symbol() : "BNB";

        if (_compareStrings(symbol, "VAI")) {
            return VAI_VALUE;
        } else {
            return _getUnderlyingPriceInternal(VBep20Interface(vToken));
        }
    }

    /**
     * @notice Get the Chainlink price of underlying asset of input vToken or cached price when it's been set
     * @dev The decimals of underlying tokens is considered to ensure the returned prices are in 18 decimals
     * @param vToken vToken address
     * @return price in USD
     */
    function _getUnderlyingPriceInternal(VBep20Interface vToken) internal view returns (uint256 price) {
        address token;
        uint256 decimals;

        // VBNB token doesn't have `underlying` method
        if (address(vToken) == vBnb) {
            token = BNB_ADDR;
            decimals = 18;
        } else {
            token = vToken.underlying();
            decimals = VBep20Interface(token).decimals();
        }

        uint256 tokenPrice = prices[token];
        if (tokenPrice != 0) {
            price = tokenPrice;
        } else {
            price = _getChainlinkPrice(token);
        }

        uint256 decimalDelta = uint256(18) - uint256(decimals);
        return price * (10 ** decimalDelta);
    }

    /**
     * @notice Get the Chainlink price of underlying asset of input vToken, revert if token config doesn't exit
     * @dev The decimals of feeds are considered
     * @param asset underlying asset address
     * @return price in USD, with 18 decimals
     * @custom:error NotNullAddress error thrown if asset address is zero
     * @custom:error Price error if chain link price of asset is not greater than zero
     * @custom:error Timing error if current timestamp is less than last updated at timestamp
     * @custom:error Timing error if time difference between current time and last update time
     * is greater than maxStalePeriod
     */
    function _getChainlinkPrice(
        address asset
    ) internal view notNullAddress(tokenConfigs[asset].asset) returns (uint256) {
        TokenConfig memory tokenConfig = tokenConfigs[asset];
        AggregatorV2V3Interface feed = AggregatorV2V3Interface(tokenConfig.feed);

        // note: maxStalePeriod cannot be 0
        uint256 maxStalePeriod = tokenConfig.maxStalePeriod;

        // Chainlink USD-denominated feeds store answers at 8 decimals, mostly
        uint256 decimalDelta = uint256(18) - feed.decimals();

        (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
        require(answer > 0, "chainlink price must be positive");

        require(block.timestamp >= updatedAt, "updatedAt exceeds block time");
        uint256 deltaTime = block.timestamp - updatedAt;
        require(deltaTime <= maxStalePeriod, "chainlink price expired");

        return uint256(answer) * (10 ** decimalDelta);
    }

    /**
     * @notice Set the forced prices of the underlying token of input vToken
     * @param vToken vToken address
     * @param underlyingPriceMantissa price in 18 decimals
     * @custom:access Only Governance
     * @custom:error NotNullAddress thrown if address of vToken is zero
     * @custom:event Emits PricePosted event on succesfully setup of underlying price
     */
    function setUnderlyingPrice(
        VBep20Interface vToken,
        uint256 underlyingPriceMantissa
    ) external notNullAddress(address(vToken)) onlyOwner {
        address asset = address(vToken) == vBnb ? BNB_ADDR : address(vToken.underlying());
        emit PricePosted(asset, prices[asset], underlyingPriceMantissa, underlyingPriceMantissa);
        prices[asset] = underlyingPriceMantissa;
    }

    /**
     * @notice Set the forced prices of the input token
     * @param asset asset address
     * @param price price in 18 decimals
     * @custom:access Only GOvernance
     * @custom:event Emits PricePosted event on succesfully setup of underlying price
     */
    function setDirectPrice(address asset, uint256 price) external onlyOwner {
        emit PricePosted(asset, prices[asset], price, price);
        prices[asset] = price;
    }

    /**
     * @notice Add multiple token configs at the same time
     * @param tokenConfigs_ config array
     * @custom:access Only Governance
     * @custom:error Zero length error thrown, if length of the array in parameter is 0
     */
    function setTokenConfigs(TokenConfig[] memory tokenConfigs_) external onlyOwner {
        require(tokenConfigs_.length > 0, "length can't be 0");
        for (uint256 i = 0; i < tokenConfigs_.length; i++) {
            setTokenConfig(tokenConfigs_[i]);
        }
    }

    /**
     * @notice Add single token config, vToken & feed cannot be zero address, and maxStalePeriod must be positive
     * @param tokenConfig token config struct
     * @custom:access Only Governance
     * @custom:error NotNullAddress error thrown if asset address is zero
     * @custom:error NotNullAddress error thrown if token feed address is zero
     * @custom:error Range error if maxStale period of token is not greater than zero
     * @custom:event Emits TokenConfigAdded event on succesfully setting up token config
     */
    function setTokenConfig(
        TokenConfig memory tokenConfig
    ) public onlyOwner notNullAddress(tokenConfig.asset) notNullAddress(tokenConfig.feed) {
        require(tokenConfig.maxStalePeriod > 0, "stale period can't be zero");
        tokenConfigs[tokenConfig.asset] = tokenConfig;
        emit TokenConfigAdded(tokenConfig.asset, tokenConfig.feed, tokenConfig.maxStalePeriod);
    }

    function _compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }
}
