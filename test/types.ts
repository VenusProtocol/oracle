import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import type { Fixture } from "ethereum-waffle";
import { VenusOracle } from "../src/types";

import type { VenusChainlinkOracle } from "../src/types/VenusChainlinkOracle";

declare module "mocha" {
  export interface Context {
    oracleBasement: VenusOracle;
    oracle: VenusChainlinkOracle;
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: SignerWithAddress[];
    admin: SignerWithAddress;
  }
}
