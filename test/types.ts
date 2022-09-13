import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import type { Fixture } from "ethereum-waffle";
import { BoundValidator, PivotPythOracle } from "../src/types";
import { ChainlinkOracle } from "../src/types/contracts/oracles/ChainlinkOracle";
import { PivotTwapOracle } from "../src/types/contracts/oracles/PivotTwapOracle";
import { ResilientOracle } from "../src/types/contracts/ResilientOracle";
import { MockPyth } from "../src/types/contracts/test/MockPyth";
import { PancakePairHarness } from "../src/types/contracts/test/PancakePairHarness";


declare module "mocha" {
  export interface Context {
    // oracle plugin tests
    oracleBasement: ResilientOracle;
    // chainlink oracle tests
    chainlinkOracle: ChainlinkOracle;
    // twap oracle tests
    twapOracle: PivotTwapOracle;
    simplePair: PancakePairHarness;
    bnbBasedPair: PancakePairHarness;
    bnbPair: PancakePairHarness;
    // bound validator tests
    boundValidator: BoundValidator;
    // common
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: SignerWithAddress[];
    admin: SignerWithAddress;
    // pyth oracle
    pythOracle: PivotPythOracle;
    underlyingPythOracle: MockPyth;
  }
}
