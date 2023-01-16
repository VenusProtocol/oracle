// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../interfaces/VBep20Interface.sol";
import "../interfaces/OracleInterface.sol";

struct ValidateConfig {
    /// @notice asset address
    address asset;
    
    /// @notice Upper bound of deviation between reported price and anchor price,
    /// beyond which the reported price will be invalidated
    uint256 upperBoundRatio;
    
    /// @notice Lower bound of deviation between reported price and anchor price,
    /// below which the reported price will be invalidated
    uint256 lowerBoundRatio;
}

// BoundValidator provides some common functions and can be used
// to wrap up other contracts to form pivot oracles
contract BoundValidator is OwnableUpgradeable, BoundValidatorInterface {
    /// @notice validation configs by asset
    mapping(address => ValidateConfig) public validateConfigs;

    /// @notice vBNB address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable vBnb;

    /// @notice Set this as asset address for BNB. This is the underlying for vBNB
    address public constant BNB_ADDR = 0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB;

    /// @notice Emit this event when new validation configs are added
    event ValidateConfigAdded(address indexed asset, uint256 indexed upperBound, uint256 indexed lowerBound);

    /// @notice Constructor for the implementation contract. Sets immutable variables.
    /// @param vBnbAddress The address of the vBNB
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address vBnbAddress) {
        require(vBnbAddress != address(0), "can't be a zero address");
        vBnb = vBnbAddress;
        _disableInitializers();
    }

    /**
     * @notice Add multiple validation configs at the same time
     * @param configs Array of validation configs
     * @custom:access Only Governance
     * @custom:error Zero length error is thrown if length of the config array is 0
     * @custom:event Emits ValidateConfigAdded for each validation config that is successfully set
     */
    function setValidateConfigs(ValidateConfig[] memory configs) external virtual onlyOwner {
        require(configs.length > 0, "invalid validate config length");
        for (uint256 i; i < configs.length; ++i) {
            setValidateConfig(configs[i]);
        }
    }

    /**
     * @notice Initializes the owner of the contract
     */
    function initialize() public initializer {
        __Ownable_init();
    }

    /**
     * @notice Add a single validation config
     * @param config Validation config struct
     * @custom:access Only Governance
     * @custom:error Null address error is thrown if asset address is null
     * @custom:error Range error thrown if bound ratio is not positive
     * @custom:error Range error thrown if lower bound is greater than upper bound
     * @custom:event Emits ValidateConfigAdded when a validation config is successfully set
     */
    function setValidateConfig(ValidateConfig memory config) public virtual onlyOwner {
        require(config.asset != address(0), "asset can't be zero address");
        require(config.upperBoundRatio > 0 && config.lowerBoundRatio > 0, "bound must be positive");
        require(config.upperBoundRatio > config.lowerBoundRatio, "upper bound must be higher than lowner bound");
        validateConfigs[config.asset] = config;
        emit ValidateConfigAdded(config.asset, config.upperBoundRatio, config.lowerBoundRatio);
    }

    /**
     * @notice Test reported asset price against anchor price
     * @param vToken vToken address
     * @param reportedPrice The price to be tested
     * @custom:error Missing error thrown if asset config is not set
     * @custom:error Price error thrown if anchor price is not valid
     */
    function validatePriceWithAnchorPrice(
        address vToken,
        uint256 reportedPrice,
        uint256 anchorPrice
    ) public view virtual override returns (bool) {
        address asset = vToken == vBnb ? BNB_ADDR : VBep20Interface(vToken).underlying();

        require(validateConfigs[asset].upperBoundRatio != 0, "validation config not exist");
        require(anchorPrice != 0, "anchor price is not valid");
        return _isWithinAnchor(asset, reportedPrice, anchorPrice);
    }

    /**
     * @notice Test whether the reported price is within the valid bounds
     * @param asset Asset address
     * @param reportedPrice The price to be tested
     * @param anchorPrice The reported price must be within the the valid bounds of this price
     */
    function _isWithinAnchor(address asset, uint256 reportedPrice, uint256 anchorPrice) internal view returns (bool) {
        if (reportedPrice > 0) {
            uint256 anchorRatio = (anchorPrice * 100e16) / reportedPrice;
            uint256 upperBoundAnchorRatio = validateConfigs[asset].upperBoundRatio;
            uint256 lowerBoundAnchorRatio = validateConfigs[asset].lowerBoundRatio;
            return anchorRatio <= upperBoundAnchorRatio && anchorRatio >= lowerBoundAnchorRatio;
        }
        return false;
    }

    // BoundValidator is to get inherited, so it's a good practice to add some storage gaps like
    // OpenZepplin proposed in their contracts: https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
    // solhint-disable-next-line
    uint256[49] private __gap;
}
