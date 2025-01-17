// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

interface IPendlePtOracle {
    function getPtToAssetRate(address market, uint32 duration) external view returns (uint256);

    function getPtToSyRate(address market, uint32 duration) external view returns (uint256);

    function getOracleState(
        address market,
        uint32 duration
    )
        external
        view
        returns (bool increaseCardinalityRequired, uint16 cardinalityRequired, bool oldestObservationSatisfied);
}
