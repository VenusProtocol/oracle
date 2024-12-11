// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import "../../interfaces/IPendlePtOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockPendlePtOracle is IPendlePtOracle, Ownable {
    mapping(address => mapping(uint32 => uint256)) public ptToAssetRate;
    mapping(address => mapping(uint32 => uint256)) public ptToSyRate;

    constructor() Ownable() {}

    function setPtToAssetRate(address market, uint32 duration, uint256 rate) external onlyOwner {
        ptToAssetRate[market][duration] = rate;
    }

    function setPtToSyRate(address market, uint32 duration, uint256 rate) external onlyOwner {
        ptToSyRate[market][duration] = rate;
    }

    function getPtToAssetRate(address market, uint32 duration) external view returns (uint256) {
        return ptToAssetRate[market][duration];
    }

    function getPtToSyRate(address market, uint32 duration) external view returns (uint256) {
        return ptToSyRate[market][duration];
    }

    function getOracleState(
        address /* market */,
        uint32 /* duration */
    )
        external
        pure
        returns (bool increaseCardinalityRequired, uint16 cardinalityRequired, bool oldestObservationSatisfied)
    {
        return (false, 0, true);
    }
}
