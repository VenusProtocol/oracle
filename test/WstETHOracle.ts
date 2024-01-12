import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { IStETH, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const MAX_STALE_PERIOD = 60 * 15; // 15min
const WSTETH = "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const WETH_USD_PRICE = parseUnits("2500", 18); // 2500 USD for 1 WETH
const WETH_USD_PRICE_DENOMINATOR = parseUnits("1", 18);
const STETH_AMOUNT_FOR_ONE_WSTETH = parseUnits("1.15", 18); // 1.5 stETH for 1 wETH

describe("WstETHOracle unit tests", () => {
  let signers: SignerWithAddress[];
  let stETHMock;
  let resilientOracleMock;
  let wstETHOracle;
  let WsETHOracleFactory;
  before(async () => {
    signers = await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
    resilientOracleMock.getPrice.returns(WETH_USD_PRICE);

    stETHMock = await smock.fake<IStETH>("IStETH");
    stETHMock.getPooledEthByShares.returns(STETH_AMOUNT_FOR_ONE_WSTETH);
    WsETHOracleFactory = await ethers.getContractFactory("WstETHOracle");
  });

  describe("deployment", () => {
    it("revert if wstETH address is 0", async () => {
      await expect(
        WsETHOracleFactory.deploy(addr0000, WETH, stETHMock.address, resilientOracleMock.address),
      ).to.be.revertedWith("can't be zero address");
    });
    it("revert if WETH address is 0", async () => {
      await expect(
        WsETHOracleFactory.deploy(WSTETH, addr0000, stETHMock.address, resilientOracleMock.address),
      ).to.be.revertedWith("can't be zero address");
    });
    it("revert if stETH address is 0", async () => {
      await expect(WsETHOracleFactory.deploy(WSTETH, WETH, addr0000, resilientOracleMock.address)).to.be.revertedWith(
        "can't be zero address",
      );
    });
    it("revert if ResilientOracle address is 0", async () => {
      await expect(WsETHOracleFactory.deploy(WSTETH, WETH, stETHMock.address, addr0000)).to.be.revertedWith(
        "can't be zero address",
      );
    });
    it("should deploy contract", async () => {
      wstETHOracle = await WsETHOracleFactory.deploy(WSTETH, WETH, stETHMock.address, resilientOracleMock.address);
    });
  });

  describe("getPrice", () => {
    it("revert if wstETH address is wrong", async () => {
      await expect(wstETHOracle.getPrice(addr0000)).to.be.revertedWith("wrong wstETH address");
    });

    it("should get correct price", async () => {
      const expectedPrice = WETH_USD_PRICE.mul(STETH_AMOUNT_FOR_ONE_WSTETH).div(WETH_USD_PRICE_DENOMINATOR);
      expect(await wstETHOracle.getPrice(WSTETH)).to.equal(expectedPrice);
    });
  });
});
