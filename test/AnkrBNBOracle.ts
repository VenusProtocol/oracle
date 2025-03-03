import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { IAnkrBNB, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const BNB_AMOUNT_FOR_ONE_ANKRBNB = parseUnits("1.075370795716558975", 18);
const ANKRBNB_USD_PRICE_DENOMINATOR = parseUnits("1", 18);
const BNB_USD_PRICE = parseUnits("300", 18); // 300 USD for 1 BNB
const ANNUAL_GROWTH_RATE = parseUnits("0.05", 18); // 5% growth
const SNAPSHOT_UPDATE_INTERVAL = 10;
const ANKRBNB_USD_PRICE = BNB_USD_PRICE.mul(BNB_AMOUNT_FOR_ONE_ANKRBNB).div(ANKRBNB_USD_PRICE_DENOMINATOR);

describe("AnkrBNBOracle unit tests", () => {
  let ankrBNBMock;
  let resilientOracleMock;
  let ankrBNBOracle;
  let ankrBNBOracleFactory;
  let timestamp;
  before(async () => {
    ({ timestamp } = await ethers.provider.getBlock("latest"));

    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
    resilientOracleMock.getPrice.returns(BNB_USD_PRICE);

    ankrBNBMock = await smock.fake<IAnkrBNB>("IAnkrBNB");
    ankrBNBMock.sharesToBonds.returns(BNB_AMOUNT_FOR_ONE_ANKRBNB);
    ankrBNBMock.decimals.returns(18);

    ankrBNBOracleFactory = await ethers.getContractFactory("AnkrBNBOracle");
  });

  describe("deployment", () => {
    it("revert if ankrBNB address is 0", async () => {
      await expect(
        ankrBNBOracleFactory.deploy(
          addr0000,
          resilientOracleMock.address,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
          BNB_AMOUNT_FOR_ONE_ANKRBNB,
          timestamp,
        ),
      ).to.be.reverted;
    });

    it("revert if ResilientOracle address is 0", async () => {
      await expect(
        ankrBNBOracleFactory.deploy(
          ankrBNBMock.address,
          addr0000,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
          BNB_AMOUNT_FOR_ONE_ANKRBNB,
          timestamp,
        ),
      ).to.be.reverted;
    });

    it("should deploy contract", async () => {
      ankrBNBOracle = await ankrBNBOracleFactory.deploy(
        ankrBNBMock.address,
        resilientOracleMock.address,
        ANNUAL_GROWTH_RATE,
        SNAPSHOT_UPDATE_INTERVAL,
        BNB_AMOUNT_FOR_ONE_ANKRBNB,
        timestamp,
      );
    });
  });

  describe("getPrice", () => {
    before(async () => {
      ankrBNBOracle = await ankrBNBOracleFactory.deploy(
        ankrBNBMock.address,
        resilientOracleMock.address,
        ANNUAL_GROWTH_RATE,
        SNAPSHOT_UPDATE_INTERVAL,
        BNB_AMOUNT_FOR_ONE_ANKRBNB,
        timestamp,
      );
    });
    it("revert if ankrBNB address is wrong", async () => {
      await expect(ankrBNBOracle.getPrice(addr0000)).to.be.revertedWithCustomError(
        ankrBNBOracle,
        "InvalidTokenAddress",
      );
    });

    it("should get correct price", async () => {
      expect(await ankrBNBOracle.getPrice(ankrBNBMock.address)).to.equal(ANKRBNB_USD_PRICE);
    });
  });
});
