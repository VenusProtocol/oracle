// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../interfaces/OracleInterface.sol";
import "./TwapOracle.sol";

struct ValidateConfig {
    /// @notice vToken address
    address vToken;
    /// @notice upper bound of deviation between reported price and stored TWAP,
    /// beyond which the reported price will be invalidated 
    uint256 upperBoundRatio;
    /// @notice lower bound of deviation between reported price and stored TWAP,
    /// below which the reported price will be invalidated 
    uint256 lowerBoundRatio;
}

// Wrap TwapOracle with pivot oracle interface to make TwapOracle standalone 
// and potentially reusable as other types of oracles in the future
contract PivotTwapOracle is TwapOracle, PivotValidator {
    using SafeMath for uint256;
    
    /// @notice validation configs by token
    mapping(address => ValidateConfig) public validateConfigs;

    /// @notice Emit this event when new validate configs are added
    event ValidateConfigAdded(
        address indexed vToken, 
        uint256 indexed upperBound,
        uint256 indexed lowerBound
    );

    /**
     * @notice Add multiple validation configs at the same time
     * @param configs config array 
     */
    function addValidateConfigs(ValidateConfig[] memory configs) external onlyOwner() {
        require(configs.length > 0, "invalid validate config length");
        for (uint8 i = 0; i < configs.length; i++) {
            addValidateConfig(configs[i]);
        }
    }

    /**
     * @notice Add single validation config
     * @param config config struct
     */
    function addValidateConfig(ValidateConfig memory config) public 
        onlyOwner()
        notNullAddress(config.vToken)
    {
        require(config.upperBoundRatio > 0 && config.lowerBoundRatio > 0, "bound must be positive");
        require(config.upperBoundRatio > config.lowerBoundRatio, "upper bound must be higher than lowner bound");
        validateConfigs[config.vToken] = config;
        emit ValidateConfigAdded(
            config.vToken, 
            config.upperBoundRatio,
            config.lowerBoundRatio
        );
    }
    
    /**
     * @notice Test reported vToken underlying price against stored TWAP
     * @param vToken vToken address
     * @param reporterPrice the price to be tested
     */
    function validatePrice(address vToken, uint256 reporterPrice) external view returns (bool) {
        require(validateConfigs[vToken].upperBoundRatio != 0, "vToken not exist");
        require(prices[vToken] != 0, "stored price is not valid");
        return isWithinAnchor(vToken, reporterPrice, prices[vToken]);
    }

    /**
     * @notice Test whether the reported price is within the predefined bounds
     * @param vToken vToken address
     * @param reporterPrice the price to be tested
     * @param anchorPrice stored TWAP price as testing anchor
     */
    function isWithinAnchor(address vToken, uint256 reporterPrice, uint256 anchorPrice) internal view returns (bool) {
        if (reporterPrice > 0) {
            uint256 anchorRatio = anchorPrice.mul(100e16).div(reporterPrice);
            uint256 upperBoundAnchorRatio = validateConfigs[vToken].upperBoundRatio;
            uint256 lowerBoundAnchorRatio = validateConfigs[vToken].lowerBoundRatio;
            return anchorRatio <= upperBoundAnchorRatio && anchorRatio >= lowerBoundAnchorRatio;
        }
        return false;
    }

}
