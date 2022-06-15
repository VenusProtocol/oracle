import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { artifacts, ethers, waffle } from "hardhat";

import type { VenusChainlinkOracle } from "../src/types/VenusChainlinkOracle";
import { Signers } from "./types";
import { makeChainlinkOracle } from "./utils/makeChainlinkOracle";
import { makeVToken } from "./utils/makeVToken";

describe("Oracle unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;

    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin = signers[0];
    this.signers.admin = admin;

    this.vToken = await makeVToken(admin, { name: "vToken", symbol: "vToken" });
    this.vBnb = await makeVToken(admin, { name: "vBnb", symbol: "vBnb" });
    this.vai = await makeVToken(admin, { name: "vai", symbol: "vai" });
    this.xvs = await makeVToken(admin, { name: "xvs", symbol: "xvs" });
    this.vExampleSet = await makeVToken(admin, { name: "vExampleSet", symbol: "vExampleSet" });
    this.vExampleUnset = await makeVToken(admin, { name: "vExampleUnset", symbol: "vExampleUnset" });
    this.vUsdc = await makeVToken(
      admin,
      { name: "vUsdc", symbol: "vUsdc" },
      { name: "USDC", symbol: "USDC", decimals: 6 },
    );
    this.vUsdt = await makeVToken(
      admin,
      { name: "vUsdt", symbol: "vUsdt" },
      { name: "USDT", symbol: "USDT", decimals: 6 },
    );
    this.vDai = await makeVToken(admin, { name: "vDai", symbol: "vDai" }, { name: "DAI", symbol: "DAI", decimals: 18 });

    this.bnbFeed = await makeChainlinkOracle(admin, 8, 30000000000);
    this.usdcFeed = await makeChainlinkOracle(admin, 8, 100000000);
    this.usdtFeed = await makeChainlinkOracle(admin, 8, 100000000);
    this.daiFeed = await makeChainlinkOracle(admin, 8, 100000000);

    const oracleArtifact = await artifacts.readArtifact("VenusChainlinkOracle");
    const oracle = await waffle.deployContract(admin, oracleArtifact, []);
    await oracle.deployed();
    this.oracle = <VenusChainlinkOracle>oracle;
  });

  describe("constructor", () => {
    it("sets address of admin", async function () {
      const admin = await this.oracle.admin();
      expect(admin).to.equal(this.signers.admin.address);
    });
  });
});
