import { FakeContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai from "chai";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

import { AccessControlManager } from "../typechain-types";
import { TokenizedStockOracle } from "../typechain-types/contracts/oracles/TokenizedStockOracle";
import { BEP20Harness } from "../typechain-types/contracts/test/BEP20Harness";
import { MockTokenizedStock } from "../typechain-types/contracts/test/MockTokenizedStock";
import { MockV3Aggregator } from "../typechain-types/contracts/test/MockV3Aggregator";
import { addr0000 } from "./utils/data";
import { getTime, increaseTime } from "./utils/time";

const { expect } = chai;
chai.use(smock.matchers);

const MAX_STALE_PERIOD = 60 * 15; // 15min
const FEED_DECIMALS = 8;

const ONE = parseUnits("1", 18); // 1.0x multiplier
const TWO = parseUnits("2", 18); // 2.0x — a 2:1 split
const HALF = parseUnits("0.5", 18); // 0.5x — a 1:2 reverse split

// $180 per share, as an 8-decimal Chainlink answer
const SHARE_PRICE_ANSWER = parseUnits("180", FEED_DECIMALS);
// ChainlinkOracle normalises to 10 ** (36 - assetDecimals)
const PRICE_18_DECIMALS = parseUnits("180", 18);
const PRICE_6_DECIMALS = parseUnits("180", 30);

describe("TokenizedStockOracle unit tests", () => {
  let admin: SignerWithAddress;
  let oracle: TokenizedStockOracle;
  let accessControlManager: FakeContract<AccessControlManager>;
  let feed: MockV3Aggregator;
  let stock: MockTokenizedStock;
  let stock6Decimals: MockTokenizedStock;
  let plainToken: BEP20Harness;

  async function deployFixture() {
    const [deployer] = await ethers.getSigners();

    const acm = await smock.fake<AccessControlManager>("AccessControlManager");
    acm.isAllowedToCall.returns(true);

    const feedFactory = await ethers.getContractFactory("MockV3Aggregator");
    const stockFeed = <MockV3Aggregator>await feedFactory.deploy(FEED_DECIMALS, SHARE_PRICE_ANSWER);

    const stockFactory = await ethers.getContractFactory("MockTokenizedStock");
    const nvdab = <MockTokenizedStock>await stockFactory.deploy("NVIDIA Corp", "NVDAB", 18, ONE);
    const sixDecimals = <MockTokenizedStock>await stockFactory.deploy("Six Decimals", "SIX", 6, ONE);

    const plainFactory = await ethers.getContractFactory("BEP20Harness");
    const plain = <BEP20Harness>await plainFactory.deploy("Plain", "PLAIN", 18);

    const oracleFactory = await ethers.getContractFactory("TokenizedStockOracle", deployer);
    const instance = <TokenizedStockOracle>await upgrades.deployProxy(oracleFactory, [acm.address], {
      constructorArgs: [],
    });

    await instance.setTokenConfigs(
      [nvdab, sixDecimals, plain].map(asset => ({
        asset: asset.address,
        feed: stockFeed.address,
        maxStalePeriod: MAX_STALE_PERIOD,
      })),
    );

    return {
      admin: deployer,
      oracle: instance,
      accessControlManager: acm,
      feed: stockFeed,
      stock: nvdab,
      stock6Decimals: sixDecimals,
      plainToken: plain,
    };
  }

  beforeEach(async () => {
    ({ admin, oracle, accessControlManager, feed, stock, stock6Decimals, plainToken } = await loadFixture(
      deployFixture,
    ));
    // loadFixture restores EVM state, but a smock fake's behaviour is configured off-chain and persists
    accessControlManager.isAllowedToCall.returns(true);
  });

  describe("setIsTokenizedStock", () => {
    it("defaults to false for an unflagged asset", async () => {
      expect(await oracle.isTokenizedStock(stock.address)).to.equal(false);
    });

    it("reverts if the asset is the zero address", async () => {
      await expect(oracle.setIsTokenizedStock(addr0000, true)).to.be.revertedWith("can't be zero address");
    });

    it("reverts if the caller is not allowed by the ACM", async () => {
      accessControlManager.isAllowedToCall.returns(false);

      await expect(oracle.setIsTokenizedStock(stock.address, true))
        .to.be.revertedWithCustomError(oracle, "Unauthorized")
        .withArgs(admin.address, oracle.address, "setIsTokenizedStock(address,bool)");
    });

    it("flags an asset and emits IsTokenizedStockUpdated", async () => {
      await expect(oracle.setIsTokenizedStock(stock.address, true))
        .to.emit(oracle, "IsTokenizedStockUpdated")
        .withArgs(stock.address, false, true);

      expect(await oracle.isTokenizedStock(stock.address)).to.equal(true);
    });

    it("unflags an asset and emits the previous value", async () => {
      await oracle.setIsTokenizedStock(stock.address, true);

      await expect(oracle.setIsTokenizedStock(stock.address, false))
        .to.emit(oracle, "IsTokenizedStockUpdated")
        .withArgs(stock.address, true, false);

      expect(await oracle.isTokenizedStock(stock.address)).to.equal(false);
    });

    it("emits an event even when the value is unchanged", async () => {
      await expect(oracle.setIsTokenizedStock(stock.address, false))
        .to.emit(oracle, "IsTokenizedStockUpdated")
        .withArgs(stock.address, false, false);
    });

    it("flags assets independently of one another", async () => {
      await oracle.setIsTokenizedStock(stock.address, true);

      expect(await oracle.isTokenizedStock(stock.address)).to.equal(true);
      expect(await oracle.isTokenizedStock(stock6Decimals.address)).to.equal(false);
    });
  });

  describe("getPrice of an unflagged asset", () => {
    it("prices a plain ERC-20 that has no uiMultiplier function at all", async () => {
      expect(await oracle.getPrice(plainToken.address)).to.equal(PRICE_18_DECIMALS);
    });

    it("ignores the multiplier of a token that reports one", async () => {
      await stock.setUIMultiplier(TWO);

      expect(await oracle.getPrice(stock.address)).to.equal(PRICE_18_DECIMALS);
    });
  });

  describe("getPrice of a flagged asset", () => {
    beforeEach(async () => {
      await oracle.setIsTokenizedStock(stock.address, true);
      await oracle.setIsTokenizedStock(stock6Decimals.address, true);
    });

    it("returns the feed price when the multiplier is 1.0", async () => {
      expect(await oracle.getPrice(stock.address)).to.equal(PRICE_18_DECIMALS);
    });

    it("doubles the price when the multiplier is 2.0 (2:1 split)", async () => {
      await stock.setUIMultiplier(TWO);

      expect(await oracle.getPrice(stock.address)).to.equal(parseUnits("360", 18));
    });

    it("halves the price when the multiplier is 0.5 (1:2 reverse split)", async () => {
      await stock.setUIMultiplier(HALF);

      expect(await oracle.getPrice(stock.address)).to.equal(parseUnits("90", 18));
    });

    it("reflects a multiplier change immediately", async () => {
      expect(await oracle.getPrice(stock.address)).to.equal(PRICE_18_DECIMALS);

      await stock.setUIMultiplier(TWO);
      expect(await oracle.getPrice(stock.address)).to.equal(parseUnits("360", 18));

      await stock.setUIMultiplier(HALF);
      expect(await oracle.getPrice(stock.address)).to.equal(parseUnits("90", 18));
    });

    it("preserves the decimal scaling of a 6-decimal token", async () => {
      expect(await oracle.getPrice(stock6Decimals.address)).to.equal(PRICE_6_DECIMALS);

      await stock6Decimals.setUIMultiplier(TWO);
      expect(await oracle.getPrice(stock6Decimals.address)).to.equal(parseUnits("360", 30));
    });

    it("rounds down when the product does not divide evenly", async () => {
      // feed answer 12345 at 8 decimals => 18-decimal price of 123450000000000
      await feed.updateAnswer(12345);
      await stock.setUIMultiplier(BigNumber.from("333333333333333333"));

      // 123450000000000 * 333333333333333333 / 1e18 = 41149999999999.99995885
      expect(await oracle.getPrice(stock.address)).to.equal("41149999999999");
    });

    it("reverts if the multiplier is zero", async () => {
      await stock.setUIMultiplier(0);

      await expect(oracle.getPrice(stock.address)).to.be.revertedWithCustomError(oracle, "InvalidMultiplier");
    });

    it("still enforces the inherited stale price check", async () => {
      await increaseTime(MAX_STALE_PERIOD + 1);

      await expect(oracle.getPrice(stock.address)).to.be.revertedWith("chainlink price expired");
    });

    it("still enforces the inherited positive price check", async () => {
      const nowSeconds = await getTime();
      await feed.updateRoundData(1111, 0, nowSeconds, nowSeconds);

      await expect(oracle.getPrice(stock.address)).to.be.revertedWith("chainlink price must be positive");
    });

    it("still reverts for an asset with no token config", async () => {
      const unconfigured = await (
        await ethers.getContractFactory("MockTokenizedStock")
      ).deploy("Unconfigured", "UNC", 18, ONE);
      await oracle.setIsTokenizedStock(unconfigured.address, true);

      await expect(oracle.getPrice(unconfigured.address)).to.be.revertedWith("can't be zero address");
    });

    it("returns a manually set direct price without scaling it by the multiplier", async () => {
      await oracle.setDirectPrice(stock.address, parseUnits("200", 18));
      await stock.setUIMultiplier(TWO);

      expect(await oracle.getPrice(stock.address)).to.equal(parseUnits("200", 18));
    });

    it("returns a direct price whatever the multiplier is, including zero", async () => {
      await oracle.setDirectPrice(stock.address, parseUnits("200", 18));
      await stock.setUIMultiplier(0);

      // the InvalidMultiplier check is never reached once a direct price is set
      expect(await oracle.getPrice(stock.address)).to.equal(parseUnits("200", 18));
    });

    it("normalises a direct price to the decimals of a 6-decimal token", async () => {
      await oracle.setDirectPrice(stock6Decimals.address, parseUnits("200", 18));
      await stock6Decimals.setUIMultiplier(TWO);

      expect(await oracle.getPrice(stock6Decimals.address)).to.equal(parseUnits("200", 30));
    });

    it("resumes multiplier scaling once the direct price is cleared", async () => {
      await oracle.setDirectPrice(stock.address, parseUnits("200", 18));
      await stock.setUIMultiplier(TWO);
      expect(await oracle.getPrice(stock.address)).to.equal(parseUnits("200", 18));

      await oracle.setDirectPrice(stock.address, 0);
      expect(await oracle.getPrice(stock.address)).to.equal(parseUnits("360", 18));
    });
  });
});
