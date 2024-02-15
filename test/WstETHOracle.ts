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
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const WETH_USD_PRICE = parseUnits("2500", 18); // 2500 USD for 1 WETH
const STETH_USD_PRICE = parseUnits("1500", 18); // 1500 USD for 1 stETH
const PRICE_DENOMINATOR = parseUnits("1", 18);
const STETH_AMOUNT_FOR_ONE_WSTETH = parseUnits("1.15", 18); // 1.5 stETH for 1 wETH

describe("WstETHOracle unit tests", () => {
  let stETHMock;
  let resilientOracleMock;
  let wstETHOracleEquivalentRatio;
  let wstETHOracleNonEquivalentRatio;
  let WsETHOracleFactory;
  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");

    stETHMock = await smock.fake<IStETH>("IStETH");
    stETHMock.getPooledEthByShares.returns(STETH_AMOUNT_FOR_ONE_WSTETH);
    WsETHOracleFactory = await ethers.getContractFactory("WstETHOracle");

    resilientOracleMock.getPrice.whenCalledWith(WETH).returns(WETH_USD_PRICE);
    resilientOracleMock.getPrice.whenCalledWith(stETHMock.address).returns(STETH_USD_PRICE);
  });

  describe("deployment", () => {
    it("revert if wstETH address is 0", async () => {
      await expect(WsETHOracleFactory.deploy(addr0000, WETH, stETHMock.address, resilientOracleMock.address, true)).to
        .be.reverted;
    });
    it("revert if WETH address is 0", async () => {
      await expect(WsETHOracleFactory.deploy(WSTETH, addr0000, stETHMock.address, resilientOracleMock.address, true)).to
        .be.reverted;
    });
    it("revert if stETH address is 0", async () => {
      await expect(WsETHOracleFactory.deploy(WSTETH, WETH, addr0000, resilientOracleMock.address, true)).to.be.reverted;
    });
    it("revert if ResilientOracle address is 0", async () => {
      await expect(WsETHOracleFactory.deploy(WSTETH, WETH, stETHMock.address, addr0000, true)).to.be.reverted;
    });
    it("should deploy contract", async () => {
      wstETHOracleEquivalentRatio = await WsETHOracleFactory.deploy(
        WSTETH,
        WETH,
        stETHMock.address,
        resilientOracleMock.address,
        true,
      );
      wstETHOracleNonEquivalentRatio = await WsETHOracleFactory.deploy(
        WSTETH,
        WETH,
        stETHMock.address,
        resilientOracleMock.address,
        false,
      );
    });
  });

  describe("getPrice", () => {
    it("revert if wstETH address is wrong", async () => {
      await expect(wstETHOracleEquivalentRatio.getPrice(addr0000)).to.be.revertedWith("wrong wstETH address");
    });

    it("should get correct price assuming 1/1 ratio", async () => {
      const expectedPrice = WETH_USD_PRICE.mul(STETH_AMOUNT_FOR_ONE_WSTETH).div(PRICE_DENOMINATOR);
      expect(await wstETHOracleEquivalentRatio.getPrice(WSTETH)).to.equal(expectedPrice);
      expect(resilientOracleMock.getPrice.atCall(0)).to.have.been.calledWith(WETH);
    });
    it("should get correct price not assuming 1/1 ratio", async () => {
      const expectedPrice = STETH_USD_PRICE.mul(STETH_AMOUNT_FOR_ONE_WSTETH).div(PRICE_DENOMINATOR);
      expect(await wstETHOracleNonEquivalentRatio.getPrice(WSTETH)).to.equal(expectedPrice);
      expect(resilientOracleMock.getPrice.atCall(1)).to.have.been.calledWith(stETHMock.address);
    });
  });
});
