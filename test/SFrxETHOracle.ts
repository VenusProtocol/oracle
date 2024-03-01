import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES, assets } from "../helpers/deploymentConfig";
import { BEP20Harness, ISfrxETH, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { sfrxETH, frxETH } = ADDRESSES.ethereum;
const WETH = assets.ethereum.find(asset => asset.token === "WETH")?.address;
const ETH_USD_PRICE = parseUnits("3100", 18); // 3100 USD for 1 ETH

describe("SFrxETHOracle unit tests", () => {
  let resilientOracleMock;
  let sfrxETHMock;
  let SFrxETHOracleFactory;
  let SFrxETHOracle;
  let wethMock;
  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");

    sfrxETHMock = await smock.fake<ISfrxETH>("ISfrxETH", { address: sfrxETH });
    sfrxETHMock.convertToAssets.returns(parseUnits("1.076546447254363344", 18));

    wethMock = await smock.fake<BEP20Harness>("BEP20Harness", { address: WETH });
    wethMock.decimals.returns(18);

    SFrxETHOracleFactory = await ethers.getContractFactory("SFrxETHOracle");
  });

  describe("deployment", () => {
    it("revert if ETH address is 0", async () => {
      await expect(
        SFrxETHOracleFactory.deploy(addr0000, frxETH, sfrxETHMock.address, resilientOracleMock.address, true),
      ).to.be.reverted;
    });
    it("revert if sfrxETH address is 0", async () => {
      await expect(SFrxETHOracleFactory.deploy(wethMock.address, frxETH, addr0000, resilientOracleMock.address, true))
        .to.be.reverted;
    });
    it("revert if sfrxETH address is 0", async () => {
      await expect(
        SFrxETHOracleFactory.deploy(wethMock.address, addr0000, sfrxETHMock.address, resilientOracleMock.address, true),
      ).to.be.reverted;
    });
    it("should deploy contract", async () => {
      SFrxETHOracle = await SFrxETHOracleFactory.deploy(
        wethMock.address,
        frxETH,
        sfrxETHMock.address,
        resilientOracleMock.address,
        true,
      );
    });
  });

  describe("getPrice", () => {
    it("revert if address is not valid sfrxETH address", async () => {
      await expect(SFrxETHOracle.getPrice(addr0000)).to.be.revertedWith("wrong token address");
    });

    it("should get correct price of sfrxETH", async () => {
      resilientOracleMock.getPrice.returns(ETH_USD_PRICE);
      const price = await SFrxETHOracle.getPrice(sfrxETHMock.address);
      expect(price).to.equal(parseUnits("3337.2939864885263664", 18));
    });
  });
});
