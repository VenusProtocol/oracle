import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES, assets } from "../helpers/deploymentConfig";
import { ISFrax, ISfraxETH, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { sfraxETH, fraxETH } = ADDRESSES.ethereum;
const WETH = assets.ethereum.find(asset => asset.token === "WETH")?.address;
const ETH_USD_PRICE = parseUnits("3100", 18); // 3100 USD for 1 ETH

describe("SFraxETHOracle unit tests", () => {
  let resilientOracleMock;
  let sFraxETHMock;
  let SFraxETHOracleFactory;
  let SFraxETHOracle;
  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");

    sFraxETHMock = await smock.fake<ISfraxETH>("ISfraxETH", { address: sfraxETH });
    sFraxETHMock.convertToAssets.returns(parseUnits("1.076546447254363344", 18));

    SFraxETHOracleFactory = await ethers.getContractFactory("SFraxETHOracle");
  });

  describe("deployment", () => {
    it("revert if ETH address is 0", async () => {
      await expect(
        SFraxETHOracleFactory.deploy(
          addr0000,
          fraxETH,
          sFraxETHMock.address,
          resilientOracleMock.address,
          true,
        ),
      ).to.be.reverted;
    });
    it("revert if sfraxETH address is 0", async () => {
      await expect(
        SFraxETHOracleFactory.deploy(WETH, fraxETH, addr0000, resilientOracleMock.address, true),
      ).to.be.reverted;
    });
    it("revert if sfraxETH address is 0", async () => {
      await expect(
        SFraxETHOracleFactory.deploy(
          WETH,
          addr0000,
          sFraxETHMock.address,
          resilientOracleMock.address,
          true,
        ),
      ).to.be.reverted;
    });
    it("should deploy contract", async () => {
      SFraxETHOracle = await SFraxETHOracleFactory.deploy(
        WETH,
        fraxETH,
        sFraxETHMock.address,
        resilientOracleMock.address,
        true,
      );
    });
  });

  describe("getPrice", () => {
    it("revert if address is not valid sfraxETH address", async () => {
      await expect(SFraxETHOracle.getPrice(addr0000)).to.be.revertedWith("wrong token address");
    });

    it("should get correct price of sfraxETH", async () => {
      resilientOracleMock.getPrice.returns(ETH_USD_PRICE);
      const price = await SFraxETHOracle.getPrice(sFraxETHMock.address);
      expect(price).to.equal(parseUnits("3337.2939864885263664", 18));
    });
  });
});
