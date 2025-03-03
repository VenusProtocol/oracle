import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { BEP20Harness, IStaderStakeManager, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { BNBx } = ADDRESSES.bscmainnet;
const EXP_SCALE = parseUnits("1", 18);
const BNB_USD_PRICE = parseUnits("300", 18); // 300 USD for 1 BNB
const BNB_FOR_ONE_BNBX = parseUnits("1.082798704659082054", 18);
const ANNUAL_GROWTH_RATE = parseUnits("0.05", 18); // 5% growth
const SNAPSHOT_UPDATE_INTERVAL = 10;
const BNBX_USD_PRICE = BNB_USD_PRICE.mul(BNB_FOR_ONE_BNBX).div(EXP_SCALE);

describe("BNBxOracle unit tests", () => {
  let BNBxStakeManagerMock;
  let resilientOracleMock;
  let BNBxOracle;
  let BNBxOracleFactory;
  let bnbxMock;
  let timestamp;
  before(async () => {
    timestamp = await ethers.provider.getBlock("latest");

    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
    resilientOracleMock.getPrice.returns(BNB_USD_PRICE);

    bnbxMock = await smock.fake<BEP20Harness>("BEP20Harness", { address: BNBx });
    bnbxMock.decimals.returns(18);

    BNBxStakeManagerMock = await smock.fake<IStaderStakeManager>("IStaderStakeManager");
    BNBxStakeManagerMock.convertBnbXToBnb.returns(BNB_FOR_ONE_BNBX);
    BNBxOracleFactory = await ethers.getContractFactory("BNBxOracle");
  });

  describe("deployment", () => {
    it("revert if stakeManager address is 0", async () => {
      await expect(
        BNBxOracleFactory.deploy(
          addr0000,
          BNBx,
          resilientOracleMock.address,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
          BNB_FOR_ONE_BNBX,
          timestamp,
        ),
      ).to.be.reverted;
    });

    it("revert if BNBx address is 0", async () => {
      await expect(
        BNBxOracleFactory.deploy(
          BNBxStakeManagerMock.address,
          addr0000,
          resilientOracleMock.address,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
          BNB_FOR_ONE_BNBX,
          timestamp,
        ),
      ).to.be.reverted;
    });

    it("revert if resilientOracle address is 0", async () => {
      await expect(
        BNBxOracleFactory.deploy(
          BNBxStakeManagerMock.address,
          BNBx,
          addr0000,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
          BNB_FOR_ONE_BNBX,
          timestamp,
        ),
      ).to.be.reverted;
    });

    it("should deploy contract", async () => {
      BNBxOracle = await BNBxOracleFactory.deploy(
        BNBxStakeManagerMock.address,
        BNBx,
        resilientOracleMock.address,
        ANNUAL_GROWTH_RATE,
        SNAPSHOT_UPDATE_INTERVAL,
        BNB_FOR_ONE_BNBX,
        timestamp,
      );
    });
  });

  describe("getPrice", () => {
    it("revert if BNBx address is wrong", async () => {
      await expect(BNBxOracle.getPrice(addr0000)).to.be.revertedWithCustomError(BNBxOracle, "InvalidTokenAddress");
    });

    it("should get correct price", async () => {
      const expectedPrice = BNB_FOR_ONE_BNBX.mul(BNB_USD_PRICE).div(EXP_SCALE);
      expect(await BNBxOracle.getPrice(BNBx)).to.equal(expectedPrice);
    });
  });
});
