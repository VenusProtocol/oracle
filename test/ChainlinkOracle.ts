import { smock } from "@defi-wonderland/smock";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";

import { AccessControlManager } from "../typechain-types";
import { ChainlinkOracle } from "../typechain-types/contracts/oracles/ChainlinkOracle";
import { addr0000 } from "./utils/data";
import { makeChainlinkOracle } from "./utils/makeChainlinkOracle";
import { makeToken } from "./utils/makeToken";
import { getTime, increaseTime } from "./utils/time";

const MAX_STALE_PERIOD = 60 * 15; // 15min

describe("Oracle unit tests", () => {
  before(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin = signers[0];
    this.signers = signers;
    this.admin = admin;

    this.bnbAddr = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";
    this.token = await makeToken("Token", "Token");
    this.vBnb = signers[5]; // Not your standard vToken
    this.vai = await makeToken("VAI", "VAI");
    this.xvs = await makeToken("XVS", "XVS");
    this.exampleSet = await makeToken("ExampleSet", "ExampleSet");
    this.exampleUnset = await makeToken("ExampleUnset", "ExampleUnset");
    this.usdc = await makeToken("USDC", "USDC", 6);
    this.usdt = await makeToken("USDT", "USDT", 6);
    this.dai = await makeToken("DAI", "DAI", 18);

    this.bnbFeed = await makeChainlinkOracle(8, 30000000000);
    this.usdcFeed = await makeChainlinkOracle(8, 100000000);
    this.usdtFeed = await makeChainlinkOracle(8, 100000000);
    this.daiFeed = await makeChainlinkOracle(8, 100000000);

    const chainlinkOracle = await ethers.getContractFactory("ChainlinkOracle", admin);
    const fakeAccessControlManager = await smock.fake<AccessControlManager>("AccessControlManager");
    fakeAccessControlManager.isAllowedToCall.returns(true);

    const instance = <ChainlinkOracle>await upgrades.deployProxy(chainlinkOracle, [fakeAccessControlManager.address], {
      constructorArgs: [],
    });
    this.chainlinkOracle = instance;
    return instance;
  });

  describe("set token config", () => {
    it("cannot set feed to zero address", async function () {
      await expect(
        this.chainlinkOracle.setTokenConfig({
          asset: this.bnbAddr,
          feed: addr0000,
          maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
        }),
      ).to.be.revertedWith("can't be zero address");
    });

    it("sets a token config", async function () {
      await this.chainlinkOracle.setTokenConfig({
        asset: this.bnbAddr,
        feed: this.bnbFeed.address,
        maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
      });
      const tokenConfig = await this.chainlinkOracle.tokenConfigs(this.bnbAddr);
      expect(tokenConfig.feed).to.be.equal(this.bnbFeed.address);
    });
  });

  describe("batch set token configs", () => {
    it("cannot set feed or vtoken to zero address", async function () {
      await expect(
        this.chainlinkOracle.setTokenConfigs([
          {
            asset: this.bnbAddr,
            feed: addr0000,
            maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
          },
        ]),
      ).to.be.revertedWith("can't be zero address");
      await expect(
        this.chainlinkOracle.setTokenConfigs([
          {
            asset: addr0000,
            feed: this.bnbFeed.address,
            maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
          },
        ]),
      ).to.be.revertedWith("can't be zero address");
    });

    it("parameter length check", async function () {
      await expect(this.chainlinkOracle.setTokenConfigs([])).to.be.revertedWith("length can't be 0");
    });

    it("set multiple feeds", async function () {
      await this.chainlinkOracle.setTokenConfigs([
        {
          asset: this.bnbAddr,
          feed: this.bnbFeed.address,
          maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD).mul(2),
        },
        {
          asset: await this.usdt.address,
          feed: this.usdtFeed.address,
          maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD).mul(3),
        },
      ]);

      const [, newBnbFeed, newBnbStalePeriod] = await this.chainlinkOracle.tokenConfigs(this.bnbAddr);
      const [, newUsdtFeed, newUsdtStalePeriod] = await this.chainlinkOracle.tokenConfigs(await this.usdt.address);

      expect(newBnbFeed).to.equal(this.bnbFeed.address);
      expect(newUsdtFeed).to.equal(this.usdtFeed.address);
      expect(newBnbStalePeriod).to.be.equal(2 * MAX_STALE_PERIOD);
      expect(newUsdtStalePeriod).to.be.equal(3 * MAX_STALE_PERIOD);
    });
  });

  describe("getPrice", () => {
    beforeEach(async function () {
      await this.chainlinkOracle.setTokenConfig({
        asset: this.bnbAddr,
        feed: this.bnbFeed.address,
        maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
      });
      await this.chainlinkOracle.setTokenConfig({
        asset: await this.usdc.address,
        feed: this.usdcFeed.address,
        maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
      });
      await this.chainlinkOracle.setTokenConfig({
        asset: await this.usdt.address,
        feed: this.usdtFeed.address,
        maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
      });
      await this.chainlinkOracle.setTokenConfig({
        asset: await this.dai.address,
        feed: this.daiFeed.address,
        maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
      });
      await this.chainlinkOracle.setDirectPrice(this.xvs.address, 7);
      await this.chainlinkOracle.setDirectPrice(this.exampleSet.address, 1);
    });

    it("gets the price from Chainlink for vBNB", async function () {
      const price = await this.chainlinkOracle.getPrice(this.bnbAddr);
      expect(price).to.equal("300000000000000000000");
    });

    it("gets the price from Chainlink for USDC", async function () {
      const price = await this.chainlinkOracle.getPrice(this.usdc.address);
      expect(price).to.equal("1000000000000000000000000000000");
    });

    it("gets the price from Chainlink for USDT", async function () {
      const price = await this.chainlinkOracle.getPrice(this.usdt.address);
      expect(price).to.equal("1000000000000000000000000000000");
    });

    it("gets the price from Chainlink for DAI", async function () {
      const price = await this.chainlinkOracle.getPrice(this.dai.address);
      expect(price).to.equal("1000000000000000000");
    });

    it("gets the direct price of a set asset", async function () {
      const price = await this.chainlinkOracle.getPrice(this.exampleSet.address);
      expect(price).to.equal("1");
    });

    it("reverts if no price or feed has been set", async function () {
      await expect(this.chainlinkOracle.getPrice(this.exampleUnset.address)).to.revertedWith("can't be zero address");
    });
  });

  describe("setDirectPrice", () => {
    it("sets the direct price", async function () {
      await this.chainlinkOracle.setDirectPrice(this.xvs.address, 7);
      const price = await this.chainlinkOracle.prices(this.xvs.address);
      expect(price).to.be.equal(7);
    });
  });

  describe("stale price validation", () => {
    beforeEach(async function () {
      await this.chainlinkOracle.setTokenConfig({
        asset: this.bnbAddr,
        feed: this.bnbFeed.address,
        maxStalePeriod: BigNumber.from(MAX_STALE_PERIOD),
      });
    });

    it("stale price period cannot be 0", async function () {
      await expect(
        this.chainlinkOracle.setTokenConfig({
          asset: this.bnbAddr,
          feed: this.bnbFeed.address,
          maxStalePeriod: 0,
        }),
      ).to.revertedWith("stale period can't be zero");
    });

    it("modify stale price period will emit an event", async function () {
      const result = await this.chainlinkOracle.setTokenConfig({
        asset: this.bnbAddr,
        feed: this.bnbFeed.address,
        maxStalePeriod: MAX_STALE_PERIOD,
      });
      await expect(result)
        .to.emit(this.chainlinkOracle, "TokenConfigAdded")
        .withArgs(this.bnbAddr, this.bnbFeed.address, MAX_STALE_PERIOD);
    });

    it("revert when price stale", async function () {
      const ADVANCE_SECONDS = 90000;
      let price = await this.chainlinkOracle.getPrice(this.bnbAddr);
      expect(price).to.equal("300000000000000000000");

      const nowSeconds = await getTime();

      await increaseTime(ADVANCE_SECONDS);

      await expect(this.chainlinkOracle.getPrice(this.bnbAddr)).to.revertedWith("chainlink price expired");

      // update round data
      await this.bnbFeed.updateRoundData(1111, 12345, nowSeconds + ADVANCE_SECONDS, nowSeconds);
      price = await this.chainlinkOracle.getPrice(this.bnbAddr);
      expect(price).to.equal(BigNumber.from(12345).mul(1e10));
    });

    it("if updatedAt is some time in the future, revert it", async function () {
      const nowSeconds = await getTime();
      await this.bnbFeed.updateRoundData(1111, 12345, nowSeconds + 900000, nowSeconds);

      await expect(this.chainlinkOracle.getPrice(this.bnbAddr)).to.revertedWith("updatedAt exceeds block time");
    });

    it("the chainlink anwser is 0, revert it", async function () {
      const nowSeconds = await getTime();
      await this.bnbFeed.updateRoundData(1111, 0, nowSeconds + 1000, nowSeconds);

      await expect(this.chainlinkOracle.getPrice(this.bnbAddr)).to.revertedWith("chainlink price must be positive");
    });
  });
});
