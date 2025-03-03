import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { assets } from "../helpers/deploymentConfig";
import { BEP20Harness, IWBETH, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const WETH = assets.ethereum.find(asset => asset.token === "WETH")?.address;
const EXP_SCALE = parseUnits("1", 18);
const ETH_USD_PRICE = parseUnits("2500", 18); // 2500 USD for 1 ETH
const ETH_FOR_ONE_WBETH = parseUnits("1.030692700354", 18);
const ANNUAL_GROWTH_RATE = parseUnits("0.05", 18); // 5% growth
const WBETH_USD_PRICE = ETH_USD_PRICE.mul(ETH_FOR_ONE_WBETH).div(EXP_SCALE);
const SNAPSHOT_UPDATE_INTERVAL = 10;

describe("WBETHOracle unit tests", () => {
  let wBETH;
  let resilientOracleMock;
  let WBETHOracle;
  let WBETHOracleFactory;
  let wethMock;
  let timestamp;
  before(async () => {
    timestamp = await ethers.provider.getBlock("latest");

    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
    resilientOracleMock.getPrice.returns(ETH_USD_PRICE);

    wethMock = await smock.fake<BEP20Harness>("BEP20Harness", { address: WETH });
    wethMock.decimals.returns(18);

    wBETH = await smock.fake<IWBETH>("IWBETH");
    wBETH.exchangeRate.returns(ETH_FOR_ONE_WBETH);
    wBETH.decimals.returns(18);
    WBETHOracleFactory = await ethers.getContractFactory("WBETHOracle");
  });

  describe("deployment", () => {
    it("revert if WBETH address is 0", async () => {
      await expect(
        WBETHOracleFactory.deploy(
          addr0000,
          wethMock.address,
          resilientOracleMock.address,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
          ETH_FOR_ONE_WBETH,
          timestamp,
        ),
      ).to.be.reverted;
    });

    it("revert if ETH address is 0", async () => {
      await expect(
        WBETHOracleFactory.deploy(
          wBETH.address,
          addr0000,
          resilientOracleMock.address,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
          ETH_FOR_ONE_WBETH,
          timestamp,
        ),
      ).to.be.reverted;
    });

    it("revert if resilientOracle address is 0", async () => {
      await expect(
        WBETHOracleFactory.deploy(
          wBETH.address,
          wethMock.address,
          addr0000,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
          ETH_FOR_ONE_WBETH,
          timestamp,
        ),
      ).to.be.reverted;
    });

    it("should deploy contract", async () => {
      WBETHOracle = await WBETHOracleFactory.deploy(
        wBETH.address,
        wethMock.address,
        resilientOracleMock.address,
        ANNUAL_GROWTH_RATE,
        SNAPSHOT_UPDATE_INTERVAL,
        ETH_FOR_ONE_WBETH,
        timestamp,
      );
    });
  });

  describe("getPrice", () => {
    it("revert if WBETH address is wrong", async () => {
      await expect(WBETHOracle.getPrice(addr0000)).to.be.revertedWithCustomError(WBETHOracle, "InvalidTokenAddress");
    });

    it("should get correct price", async () => {
      const expectedPrice = ETH_FOR_ONE_WBETH.mul(ETH_USD_PRICE).div(EXP_SCALE);
      expect(await WBETHOracle.getPrice(wBETH.address)).to.equal(expectedPrice);
    });
  });
});
