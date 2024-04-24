// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import "../../interfaces/IPendlePtOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockPendlePtOracle is IPendlePtOracle, Ownable {
    mapping (address => mapping(uint32 => uint256)) public ptToAssetRate;

    constructor() Ownable() {}

    function setPtToAssetRate(address market, uint32 duration, uint256 rate) external onlyOwner {
        ptToAssetRate[market][duration] = rate;
    }

    function getPtToAssetRate(address market, uint32 duration) external view returns (uint256) {
        return 1;
    }

    function getOracleState(
        address market,
        uint32 duration
    ) external view returns (bool increaseCardinalityRequired, uint16 cardinalityRequired, bool oldestObservationSatisfied) {
        return (false, 0, true);
    }
}
