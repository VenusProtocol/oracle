import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES, assets} from "../helpers/deploymentConfig";
import { IEETH, IWeETH, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { weETH, eETH } = ADDRESSES.ethereum;
const WETH = assets.ethereum.find(asset => asset.token === "WETH")?.address;
const ETH_USD_PRICE = parseUnits("3100", 18); // 3100 USD for 1 ETH

describe("WeETHOracle unit tests", () => {
  let weETHMock;
  let resilientOracleMock;
  let eETHMock;
  let WeETHOracleFactory;
  let WeETHOracle;
  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
    resilientOracleMock.getPrice.returns(ETH_USD_PRICE);

    weETHMock = await smock.fake<IWeETH>("IWeETH", { address: weETH });
    eETHMock = await smock.fake<IEETH>("IEETH", { address: eETH });

    weETHMock.getEETHByWeETH.returns(parseUnits("1.032226887617316822", 18));
    WeETHOracleFactory = await ethers.getContractFactory("WeETHOracle");
  });

  describe("deployment", () => {
    it("revert if WETH address is 0", async () => {
      await expect(WeETHOracleFactory.deploy(addr0000, eETHMock.address, weETHMock.address, resilientOracleMock.address, true)).to.be
        .reverted;
    });

    it("revert if weETH address is 0", async () => {
      await expect(WeETHOracleFactory.deploy(WETH, eETHMock.address, addr0000, resilientOracleMock.address, true)).to.be
        .reverted;
    });
    it("revert if eETH address is 0", async () => {
      await expect(WeETHOracleFactory.deploy(WETH, addr0000, weETHMock.address, resilientOracleMock.address, true)).to.be
        .reverted;
    });
    it("revert if resilient oracle address is 0", async () => {
      await expect(WeETHOracleFactory.deploy(WETH, eETHMock.address, weETHMock.address, addr0000, true)).to.be.reverted;
    });
    it("should deploy contract", async () => {
      WeETHOracle = await WeETHOracleFactory.deploy(
        WETH,
        eETHMock.address,
        weETHMock.address,
        resilientOracleMock.address,
        true,
      );
    });
  });

  describe("getPrice", () => {
    it("revert if address is not valid weETH or eETH address", async () => {
      await expect(WeETHOracle.getPrice(addr0000)).to.be.revertedWith("wrong token address");
    });

    it("should get correct price of weETH", async () => {
      const price = await WeETHOracle.getPrice(weETHMock.address);
      expect(price).to.equal(parseUnits("3199.9033516136821482", 18));
    });
  });
});
