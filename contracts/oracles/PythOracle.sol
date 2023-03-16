// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/utils/math/SignedMath.sol";
import "../interfaces/PythInterface.sol";
import "../interfaces/OracleInterface.sol";
import "../interfaces/VBep20Interface.sol";
import "../Governance/AccessControlled.sol";

struct TokenConfig {
    bytes32 pythId;
    address asset;
    uint64 maxStalePeriod;
}

/**
 * PythOracle contract reads prices from actual Pyth oracle contract which accepts, verifies and stores the
 * updated prices from external sources
 */
contract PythOracle is AccessControlled, OracleInterface {
    using SafeMath for uint256;

    // To calculate 10 ** n(which is a signed type)
    using SignedMath for int256;

    // To cast int64/int8 types from Pyth to unsigned types
    using SafeCast for int256;

    /// @notice Exponent scale (decimal precision) of prices
    uint256 public constant EXP_SCALE = 1e18;

    /// @notice vBNB address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vBnb;

    /// @notice VAI address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vai;

    /// @notice Set this as asset address for BNB. This is the underlying for vBNB
    address public constant BNB_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice The actual pyth oracle address fetch & store the prices
    IPyth public underlyingPythOracle;

    /// @notice Token configs by asset address
    mapping(address => TokenConfig) public tokenConfigs;

    /// @notice Emit when setting a new pyth oracle address
    event PythOracleSet(address indexed newPythOracle);

    /// @notice Emit when a token config is added
    event TokenConfigAdded(address indexed vToken, bytes32 indexed pythId, uint64 indexed maxStalePeriod);

    modifier notNullAddress(address someone) {
        require(someone != address(0), "can't be zero address");
        _;
    }

    /// @notice Constructor for the implementation contract. Sets immutable variables.
    /// @param vBnbAddress The address of the vBNB
    /// @param vaiAddress The address of the VAI
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address vBnbAddress, address vaiAddress) notNullAddress(vBnbAddress) notNullAddress(vaiAddress) {
        vBnb = vBnbAddress;
        vai = vaiAddress;
        _disableInitializers();
    }

    /**
     * @notice Batch set token configs
     * @param tokenConfigs_ Token config array
     * @custom:access Only Governance
     * @custom:error Zero length error is thrown if length of the array in parameter is 0
     */
    function setTokenConfigs(TokenConfig[] memory tokenConfigs_) external {
        _checkAccessAllowed("setTokenConfigs(TokenConfig[])");
        require(tokenConfigs_.length != 0, "length can't be 0");
        uint256 numTokenConfigs = tokenConfigs_.length;
        for (uint256 i; i < numTokenConfigs; ++i) {
            setTokenConfig(tokenConfigs_[i]);
        }
    }

    /**
     * @notice Set the underlying Pyth oracle contract address
     * @param underlyingPythOracle_ Pyth oracle contract address
     * @custom:access Only Governance
     * @custom:error NotNullAddress error thrown if underlyingPythOracle_ address is zero
     * @custom:event Emits PythOracleSet event with address of Pyth oracle.
     */
    function setUnderlyingPythOracle(
        IPyth underlyingPythOracle_
    ) external notNullAddress(address(underlyingPythOracle_)) {
        _checkAccessAllowed("setUnderlyingPythOracle(IPyth)");
        underlyingPythOracle = underlyingPythOracle_;
        emit PythOracleSet(address(underlyingPythOracle_));
    }

    /**
     * @notice Initializes the owner of the contract and sets required contracts
     * @param underlyingPythOracle_ Address of the Pyth oracle
     * @param accessControlManager_ Address of the access control manager contract
     */
    function initialize(address underlyingPythOracle_, address accessControlManager_) public initializer {
        __Ownable2Step_init();
        __AccessControlled_init_unchained(accessControlManager_);

        require(underlyingPythOracle_ != address(0), "pyth oracle cannot be zero address");
        underlyingPythOracle = IPyth(underlyingPythOracle_);
        emit PythOracleSet(underlyingPythOracle_);
    }

    /**
     * @notice Set single token config. `maxStalePeriod` cannot be 0 and `vToken` can be a null address
     * @param tokenConfig Token config struct
     * @custom:access Only Governance
     * @custom:error Range error is thrown if max stale period is zero
     * @custom:error NotNullAddress error is thrown if asset address is null
     */
    function setTokenConfig(TokenConfig memory tokenConfig) public notNullAddress(tokenConfig.asset) {
        _checkAccessAllowed("setTokenConfig(TokenConfig)");
        require(tokenConfig.maxStalePeriod != 0, "max stale period cannot be 0");
        tokenConfigs[tokenConfig.asset] = tokenConfig;
        emit TokenConfigAdded(tokenConfig.asset, tokenConfig.pythId, tokenConfig.maxStalePeriod);
    }

    /**
     * @notice Get price of underlying asset of the input vToken, under the hood this function
     * get price from Pyth contract, the prices of which are updated externally
     * @param vToken vToken address
     * @return price Underlying price with a precision of 10 decimals
     * @custom:error Zero address error thrown if underlyingPythOracle address is null
     * @custom:error Zero address error thrown if asset address is null
     * @custom:error Range error thrown if price of Pyth oracle is not greater than zero
     */
    function getUnderlyingPrice(address vToken) public view override returns (uint256) {
        require(address(underlyingPythOracle) != address(0), "Pyth oracle is zero address");

        address asset;
        uint256 decimals;

        // VBNB token doesn't have `underlying` method
        if (address(vToken) == vBnb) {
            asset = BNB_ADDR;
            decimals = 18;
        } else if (address(vToken) == vai) {
            asset = vai;
            decimals = 18;
        } else {
            asset = VBep20Interface(vToken).underlying();
            decimals = VBep20Interface(asset).decimals();
        }

        TokenConfig storage tokenConfig = tokenConfigs[asset];
        require(tokenConfig.asset != address(0), "asset doesn't exist");

        // if the price is expired after it's compared against `maxStalePeriod`, the following call will revert
        PythStructs.Price memory priceInfo = underlyingPythOracle.getPriceNoOlderThan(
            tokenConfig.pythId,
            tokenConfig.maxStalePeriod
        );

        uint256 price = int256(priceInfo.price).toUint256();

        require(price > 0, "Pyth oracle price must be positive");

        // the price returned from Pyth is price ** 10^expo, which is the real dollar price of the assets
        // we need to multiply it by 1e18 to make the price 18 decimals
        if (priceInfo.expo > 0) {
            return price.mul(EXP_SCALE).mul(10 ** int256(priceInfo.expo).toUint256()) * (10 ** (18 - decimals));
        } else {
            return price.mul(EXP_SCALE).div(10 ** int256(-priceInfo.expo).toUint256()) * (10 ** (18 - decimals));
        }
    }
}
