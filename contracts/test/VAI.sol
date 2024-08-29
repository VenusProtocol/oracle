// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.5.16;
import "@venusprotocol/venus-protocol/contracts/Tokens/VAI/VAI.sol";

contract VAIScenario is VAI {
    constructor(uint256 chainId) public VAI(chainId) {}
}
