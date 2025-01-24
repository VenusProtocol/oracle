// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { CorrelatedTokenOracle } from "../../oracles/common/CorrelatedTokenOracle.sol";

contract MockCorrelatedTokenOracle is CorrelatedTokenOracle {
    uint256 public mockUnderlyingAmount;

    constructor(
        address correlatedToken,
        address underlyingToken,
        address resilientOracle,
        uint256 annualGrowthRate,
        uint256 snapshotInterval
    ) CorrelatedTokenOracle(correlatedToken, underlyingToken, resilientOracle, annualGrowthRate, snapshotInterval) {}

    function setMockUnderlyingAmount(uint256 amount) external {
        mockUnderlyingAmount = amount;
    }

    function _getUnderlyingAmount() internal view override returns (uint256) {
        return mockUnderlyingAmount;
    }
}
