import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import type { Fixture } from "ethereum-waffle";
import { VenusChainlinkOracle, VenusOracle } from "../src/types";
import { PivotTwapOracle } from "../src/types/contracts/oracles/PivotTwapOracle";
import { PythOracle } from "../src/types/contracts/oracles/PythOracle";
import { MockPyth } from "../src/types/contracts/test/MockPyth";
import { PancakePairHarness } from "../src/types/contracts/test/PancakePairHarness";


declare module "mocha" {
  export interface Context {
    // oracle plugin tests
    oracleBasement: VenusOracle;
    // chainlink oracle tests
    oracle: VenusChainlinkOracle;
    // twap oracle tests
    twapOracle: PivotTwapOracle;
    simplePair: PancakePairHarness;
    bnbBasedPair: PancakePairHarness;
    bnbPair: PancakePairHarness;
    // common
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: SignerWithAddress[];
    admin: SignerWithAddress;
    // pyth oracle
    pythOracle: PythOracle;
    underlyingPythOracle: MockPyth;
  }
}
