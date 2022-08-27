import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { artifacts, ethers, waffle } from "hardhat";
import { ChainlinkOracle } from "../src/types/contracts/oracles/ChainlinkOracle";
import { addr0000 } from "./utils/data";

import { makeChainlinkOracle } from "./utils/makeChainlinkOracle";
import { makeVToken } from "./utils/makeVToken";
import { getTime, increaseTime } from "./utils/time";

const MAX_STALE_PERIOD = 60 * 15; // 15min

describe("Oracle unit tests", function () {
  before(async function () {

    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin = signers[0];
    this.signers = signers;
    this.admin = admin;

    this.vToken = await makeVToken(admin, { name: "vToken", symbol: "vToken" }, { name: "Token", symbol: "Token" });
    this.vBnb = await makeVToken(admin, { name: "vBNB", symbol: "vBNB" }, { name: "BNB", symbol: "BNB" });
    this.vai = await makeVToken(admin, { name: "VAI", symbol: "VAI" });
    this.xvs = await makeVToken(admin, { name: "XVS", symbol: "XVS" });
    this.vExampleSet = await makeVToken(admin, { name: "vExampleSet", symbol: "vExampleSet" });
    this.vExampleUnset = await makeVToken(admin, { name: "vExampleUnset", symbol: "vExampleUnset" });
    this.vUsdc = await makeVToken(
      admin,
      { name: "vUSDC", symbol: "vUSDC" },
      { name: "USDC", symbol: "USDC", decimals: 6 },
    );
    this.vUsdt = await makeVToken(
      admin,
      { name: "vUSDT", symbol: "vUSDT" },
      { name: "USDT", symbol: "USDT", decimals: 6 },
    );
    this.vDai = await makeVToken(admin, { name: "vDAI", symbol: "vDAI" }, { name: "DAI", symbol: "DAI", decimals: 18 });

    this.bnbFeed = await makeChainlinkOracle(admin, 8, 30000000000);
    this.usdcFeed = await makeChainlinkOracle(admin, 8, 100000000);
    this.usdtFeed = await makeChainlinkOracle(admin, 8, 100000000);
    this.daiFeed = await makeChainlinkOracle(admin, 8, 100000000);

    const oracleArtifact = await artifacts.readArtifact("ChainlinkOracle");
    const oracle = await waffle.deployContract(admin, oracleArtifact, []);
    await oracle.deployed();
    this.oracle = <ChainlinkOracle>oracle;
  });

  describe("constructor", () => {
    it("sets address of admin", async function () {
      const admin = await this.oracle.admin();
      expect(admin).to.equal(this.admin.address);
    });    
  });

  describe("set token config", () => {
    it("only admin may set token config", async function () {
      await expect(
        this.oracle.connect(this.signers[2]).setTokenConfig({
          vToken: this.vBnb.address,
          feed: this.bnbFeed.address,
          maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
        })
      ).to.be.revertedWith("only admin may call");
    });

    it("cannot set feed to zero address", async function () {
      await expect(
        this.oracle.setTokenConfig({
          vToken: this.vBnb.address,
          feed: addr0000,
          maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
      })).to.be.revertedWith("can't be zero address")
    });

    it("sets a token config", async function () {
      await this.oracle.setTokenConfig({
        vToken: this.vBnb.address,
        feed: this.bnbFeed.address,
        maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
      });
      const tokenConfig = await this.oracle.tokenConfigs(this.vBnb.address);
      expect(tokenConfig.feed).to.be.equal(this.bnbFeed.address);
    });
  });

  describe('batch set token configs', () => {
    it("only admin may set token configs", async function () {
      await expect(
        this.oracle.connect(this.signers[2]).setTokenConfigs([{
          vToken: this.vBnb.address,
          feed: this.bnbFeed.address,
          maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
        }])
      ).to.be.revertedWith("only admin may call");
    });

    it('cannot set feed or vtoken to zero address', async function () {
      await expect(
        this.oracle.setTokenConfigs([{
          vToken: this.vBnb.address,
          feed: addr0000,
          maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
        }])
      ).to.be.revertedWith("can't be zero address");
      await expect(
        this.oracle.setTokenConfigs([{
          vToken: addr0000,
          feed: this.bnbFeed.address,
          maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
        }])
      ).to.be.revertedWith("can't be zero address");
    });

    it('parameter length check', async function () {
      await expect(
        this.oracle.setTokenConfigs([])
      ).to.be.revertedWith("length can't be 0");
    });

    it("set multiple feeds", async function () {
      await this.oracle.setTokenConfigs([{
        vToken: this.vBnb.address,
        feed: this.bnbFeed.address,
        maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD).mul(2),
      }, {
        vToken: this.vUsdt.address,
        feed: this.usdtFeed.address,
        maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD).mul(3),
      }]);

      const [,newBnbFeed, newBnbStalePeriod] = await this.oracle.tokenConfigs(this.vBnb.address);
      const [,newUsdtFeed, newUsdtStalePeriod] = await this.oracle.tokenConfigs(this.vUsdt.address);

      expect(newBnbFeed).to.equal(this.bnbFeed.address);
      expect(newUsdtFeed).to.equal(this.usdtFeed.address);
      expect(newBnbStalePeriod).to.be.equal(2 * MAX_STALE_PERIOD);
      expect(newUsdtStalePeriod).to.be.equal(3 * MAX_STALE_PERIOD);
    });
  });

  describe("getUnderlyingPrice", () => {
    beforeEach(async function () {
      await this.oracle.setTokenConfig({
        vToken: this.vBnb.address,
        feed: this.bnbFeed.address,
        maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
      });
      await this.oracle.setTokenConfig({
        vToken: this.vUsdc.address,
        feed: this.usdcFeed.address,
        maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
      });
      await this.oracle.setTokenConfig({
        vToken: this.vUsdt.address,
        feed: this.usdtFeed.address,
        maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
      });
      await this.oracle.setTokenConfig({
        vToken: this.vDai.address,
        feed: this.daiFeed.address,
        maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
      });
      await this.oracle.setDirectPrice(this.xvs.address, 7);
      await this.oracle.setUnderlyingPrice(this.vExampleSet.address, 1);
    });

    it("gets the price from Chainlink for vBNB", async function () {
      const price = await this.oracle.getUnderlyingPrice(this.vBnb.address);
      expect(price).to.equal("300000000000000000000");
    });

    it("gets the price from Chainlink for USDC", async function () {
      const price = await this.oracle.getUnderlyingPrice(this.vUsdc.address);
      expect(price).to.equal("1000000000000000000000000000000");
    });

    it("gets the price from Chainlink for USDT", async function () {
      const price = await this.oracle.getUnderlyingPrice(this.vUsdt.address);
      expect(price).to.equal("1000000000000000000000000000000");
    })

    it("gets the price from Chainlink for DAI", async function () {
      const price = await this.oracle.getUnderlyingPrice(this.vDai.address);
      expect(price).to.equal("1000000000000000000");
    });

    it("gets the direct price of VAI", async function () {
      const price = await this.oracle.getUnderlyingPrice(this.vai.address);
      expect(price).to.equal("1000000000000000000");
    });

    it("gets the constant price of XVS", async function () {
      const price = await this.oracle.getUnderlyingPrice(this.xvs.address);
      expect(price).to.equal("7");
    });

    it("gets the direct price of a set asset", async function () {
      const price = await this.oracle.getUnderlyingPrice(this.vExampleSet.address);
      expect(price).to.equal("1");
    });

    it("reverts if no price or feed has been set", async function () {
      await expect(
        this.oracle.getUnderlyingPrice(this.vExampleUnset.address)
      ).to.revertedWith('can\'t be zero address');
    });
  });

  describe("setUnderlyingPrice", () => {
    it("only admin may set an underlying price", async function () {
      await expect(
        this.oracle.connect(this.signers[2]).setUnderlyingPrice(this.vExampleSet.address, 1)
      ).to.be.revertedWith("only admin may call");
    });

    it("sets the underlying price", async function () {
      await this.oracle.setUnderlyingPrice(this.vExampleSet.address, 1);
      const underlying = await this.vExampleSet.underlying();
      const price = await this.oracle.prices(underlying);
      expect(price).to.be.equal("1");
    });
  });

  describe("setDirectPrice", () => {
    it("only admin may set an underlying price", async function () {
      await expect(
        this.oracle.connect(this.signers[2]).setUnderlyingPrice(this.xvs.address, 7)
      ).to.be.revertedWith("only admin may call");
    });

    it("sets the direct price", async function () {
      await this.oracle.setDirectPrice(this.xvs.address, 7);
      const price = await this.oracle.prices(this.xvs.address);
      expect(price).to.be.equal(7);
    });
  });

  describe('stale price validation', () => {
    beforeEach(async function () {
      await this.oracle.setTokenConfig({
        vToken: this.vBnb.address,
        feed: this.bnbFeed.address,
        maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
      });
    });

    it('stale price period cannot be 0', async function () {
      await expect(
        this.oracle.setTokenConfig({
          vToken: this.vBnb.address,
          feed: this.bnbFeed.address,
          maxStalePeriod: 0,
        })
      ).to.revertedWith('stale period can\'t be zero');
    });

    it('modify stale price period will emit an event', async function () {
      const result = await this.oracle.setTokenConfig({
        vToken: this.vBnb.address,
        feed: this.bnbFeed.address,
        maxStalePeriod: MAX_STALE_PERIOD,
      })
      await expect(result).to.emit(this.oracle, 'TokenConfigAdded').withArgs(
        this.vBnb.address, this.bnbFeed.address, MAX_STALE_PERIOD
      )
    });

    it('get underlying will return 0 if price stale', async function () {
      const ADVANCE_SECONDS = 90000;
      let price = await this.oracle.getUnderlyingPrice(this.vBnb.address);
      expect(price).to.equal('300000000000000000000');
      
      const nowSeconds = await getTime();

      await increaseTime(ADVANCE_SECONDS);

      price = await this.oracle.getUnderlyingPrice(this.vBnb.address);
      expect(price).to.equal('0');

      // update round data
      await this.bnbFeed.updateRoundData(1111, 12345, nowSeconds + ADVANCE_SECONDS, nowSeconds);
      price = await this.oracle.getUnderlyingPrice(this.vBnb.address);
      expect(price).to.equal(BigNumber.from(12345).mul(1e10));
    });

    it('if updatedAt is some time in the future, revert it', async function () {
      const nowSeconds = await getTime();
      await this.bnbFeed.updateRoundData(1111, 12345, nowSeconds + 900000, nowSeconds);

      await expect(
        this.oracle.getUnderlyingPrice(this.vBnb.address),
      ).to.revertedWith('updatedAt exceeds block time');
    });
  })
});
