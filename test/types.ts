import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import type { Fixture } from "ethereum-waffle";

import type { VenusChainlinkOracle } from "../src/types/VenusChainlinkOracle";

declare module "mocha" {
  export interface Context {
    oracle: VenusChainlinkOracle;
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: SignerWithAddress[];
    admin: SignerWithAddress;
  }
}
