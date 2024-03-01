import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { IStETH, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const WSTETH = ADDRESSES.ethereum.wstETHAddress;
const STETH_USD_PRICE = parseUnits("1500", 18); // 1500 USD for 1 stETH
const PRICE_DENOMINATOR = parseUnits("1", 18);
const STETH_AMOUNT_FOR_ONE_WSTETH = parseUnits("1.15", 18); // 1.5 stETH for 1 wETH

describe("WstETHOracle unit tests", () => {
  let stETHMock;
  let resilientOracleMock;
  let wstETHOracle;
  let WsETHOracleFactory;
  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");

    stETHMock = await smock.fake<IStETH>("IStETH");
    stETHMock.getPooledEthByShares.returns(STETH_AMOUNT_FOR_ONE_WSTETH);
    stETHMock.decimals.returns(18);
    WsETHOracleFactory = await ethers.getContractFactory("WstETHOracle");

    resilientOracleMock.getPrice.returns(STETH_USD_PRICE);
  });

  describe("deployment", () => {
    it("revert if wstETH address is 0", async () => {
      await expect(WsETHOracleFactory.deploy(addr0000, stETHMock.address, resilientOracleMock.address)).to.be.reverted;
    });
    it("revert if stETH address is 0", async () => {
      await expect(WsETHOracleFactory.deploy(WSTETH, addr0000, resilientOracleMock.address)).to.be.reverted;
    });
    it("revert if ResilientOracle address is 0", async () => {
      await expect(WsETHOracleFactory.deploy(WSTETH, stETHMock.address, addr0000)).to.be.reverted;
    });
    it("should deploy contract", async () => {
      wstETHOracle = await WsETHOracleFactory.deploy(WSTETH, stETHMock.address, resilientOracleMock.address);
    });
  });

  describe("getPrice", () => {
    it("revert if wstETH address is wrong", async () => {
      await expect(wstETHOracle.getPrice(addr0000)).to.be.revertedWith("wrong token address");
    });

    it("should get correct price", async () => {
      const expectedPrice = STETH_USD_PRICE.mul(STETH_AMOUNT_FOR_ONE_WSTETH).div(PRICE_DENOMINATOR);
      expect(await wstETHOracle.getPrice(WSTETH)).to.equal(expectedPrice);
    });
  });
});
