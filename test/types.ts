import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { BoundValidator, PythOracle } from "../typechain-types";
import { ResilientOracle } from "../typechain-types/contracts/ResilientOracle";
import { ChainlinkOracle } from "../typechain-types/contracts/oracles/ChainlinkOracle";
import { MockPyth } from "../typechain-types/contracts/test/MockPyth";
import { PancakePairHarness } from "../typechain-types/contracts/test/PancakePairHarness";

declare module "mocha" {
  export interface Context {
    // oracle plugin tests
    oracleBasement: ResilientOracle;
    // chainlink oracle tests
    chainlinkOracle: ChainlinkOracle;
    // twap oracle tests
    simplePair: PancakePairHarness;
    bnbBasedPair: PancakePairHarness;
    bnbPair: PancakePairHarness;
    // bound validator tests
    boundValidator: BoundValidator;
    signers: SignerWithAddress[];
    admin: SignerWithAddress;
    // pyth oracle
    pythOracle: PythOracle;
    underlyingPythOracle: MockPyth;
  }
}
