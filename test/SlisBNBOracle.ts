import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { BEP20Harness, ISynclubStakeManager, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { slisBNB } = ADDRESSES.bscmainnet;
const EXP_SCALE = parseUnits("1", 18);
const BNB_USD_PRICE = parseUnits("300", 18); // 300 USD for 1 BNB
const BNB_FOR_ONE_SLISBNB = parseUnits("1.014061147834812261", 18);
const ANNUAL_GROWTH_RATE = parseUnits("0.05", 18); // 5% growth
const SLISBNB_USD_PRICE = BNB_USD_PRICE.mul(BNB_FOR_ONE_SLISBNB).div(EXP_SCALE);
const SNAPSHOT_UPDATE_INTERVAL = 10;

describe("SlisBNBOracle unit tests", () => {
  let SynclubManagerMock;
  let resilientOracleMock;
  let SlisBNBOracle;
  let SlisBNBOracleFactory;
  let slisBNBMock;
  let timestamp;
  before(async () => {
    ({ timestamp } = await ethers.provider.getBlock("latest"));

    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
    resilientOracleMock.getPrice.returns(BNB_USD_PRICE);

    slisBNBMock = await smock.fake<BEP20Harness>("BEP20Harness", { address: slisBNB });
    slisBNBMock.decimals.returns(18);

    SynclubManagerMock = await smock.fake<ISynclubStakeManager>("ISynclubStakeManager");
    SynclubManagerMock.convertSnBnbToBnb.returns(BNB_FOR_ONE_SLISBNB);
    SlisBNBOracleFactory = await ethers.getContractFactory("SlisBNBOracle");
  });

  describe("deployment", () => {
    it("revert if SynclubManager address is 0", async () => {
      await expect(
        SlisBNBOracleFactory.deploy(
          addr0000,
          slisBNB,
          resilientOracleMock.address,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
          BNB_FOR_ONE_SLISBNB,
          timestamp,
        ),
      ).to.be.reverted;
    });

    it("revert if slisBNB address is 0", async () => {
      await expect(
        SlisBNBOracleFactory.deploy(
          SynclubManagerMock.address,
          addr0000,
          resilientOracleMock.address,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
          BNB_FOR_ONE_SLISBNB,
          timestamp,
        ),
      ).to.be.reverted;
    });

    it("revert if resilientOracle address is 0", async () => {
      await expect(
        SlisBNBOracleFactory.deploy(
          SynclubManagerMock.address,
          slisBNB,
          addr0000,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
          BNB_FOR_ONE_SLISBNB,
          timestamp,
        ),
      ).to.be.reverted;
    });

    it("should deploy contract", async () => {
      SlisBNBOracle = await SlisBNBOracleFactory.deploy(
        SynclubManagerMock.address,
        slisBNB,
        resilientOracleMock.address,
        ANNUAL_GROWTH_RATE,
        SNAPSHOT_UPDATE_INTERVAL,
        BNB_FOR_ONE_SLISBNB,
        timestamp,
      );
    });
  });

  describe("getPrice", () => {
    it("revert if slisBNB address is wrong", async () => {
      await expect(SlisBNBOracle.getPrice(addr0000)).to.be.revertedWithCustomError(
        SlisBNBOracle,
        "InvalidTokenAddress",
      );
    });

    it("should get correct price", async () => {
      const expectedPrice = BNB_FOR_ONE_SLISBNB.mul(BNB_USD_PRICE).div(EXP_SCALE);
      expect(await SlisBNBOracle.getPrice(slisBNB)).to.equal(expectedPrice);
    });
  });
});
