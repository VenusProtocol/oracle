import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES, assets } from "../helpers/deploymentConfig";
import { ISFrax, ISfraxETH, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { FRAX, sFRAX, sfraxETH, fraxETH } = ADDRESSES.ethereum;
const WETH = assets.ethereum.find(asset => asset.token === "WETH")?.address;
const FRAX_USD_PRICE = parseUnits("0.9979", 18); // 0.99 USD for 1 FRAX
const ETH_USD_PRICE = parseUnits("3100", 18); // 3100 USD for 1 ETH

describe("FraxOracle unit tests", () => {
  let sFraxMock;
  let resilientOracleMock;
  let sFraxETHMock;
  let FraxOracleFactory;
  let FraxOracle;
  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");

    sFraxMock = await smock.fake<ISFrax>("ISFrax", { address: sFRAX });
    sFraxETHMock = await smock.fake<ISfraxETH>("ISfraxETH", { address: sfraxETH });

    sFraxMock.convertToAssets.returns(parseUnits("1.019194969966192602", 18));
    sFraxETHMock.convertToAssets.returns(parseUnits("1.076546447254363344", 18));

    FraxOracleFactory = await ethers.getContractFactory("FraxOracle");
  });

  describe("deployment", () => {
    it("revert if FRAX address is 0", async () => {
      await expect(
        FraxOracleFactory.deploy(
          addr0000,
          sFraxMock.address,
          WETH,
          sFraxETHMock.address,
          fraxETH,
          resilientOracleMock.address,
          true,
        ),
      ).to.be.reverted;
    });
    it("revert if sFRAX address is 0", async () => {
      await expect(
        FraxOracleFactory.deploy(
          FRAX,
          addr0000,
          WETH,
          sFraxETHMock.address,
          fraxETH,
          resilientOracleMock.address,
          true,
        ),
      ).to.be.reverted;
    });
    it("revert if ETH address is 0", async () => {
      await expect(
        FraxOracleFactory.deploy(
          FRAX,
          sFraxMock.address,
          addr0000,
          sFraxETHMock.address,
          fraxETH,
          resilientOracleMock.address,
          true,
        ),
      ).to.be.reverted;
    });
    it("revert if sfraxETH address is 0", async () => {
      await expect(
        FraxOracleFactory.deploy(FRAX, sFraxMock.address, WETH, addr0000, fraxETH, resilientOracleMock.address, true),
      ).to.be.reverted;
    });
    it("revert if sfraxETH address is 0", async () => {
      await expect(
        FraxOracleFactory.deploy(
          FRAX,
          sFraxMock.address,
          WETH,
          sFraxETHMock.address,
          addr0000,
          resilientOracleMock.address,
          true,
        ),
      ).to.be.reverted;
    });
    it("should deploy contract", async () => {
      FraxOracle = await FraxOracleFactory.deploy(
        FRAX,
        sFraxMock.address,
        WETH,
        sFraxETHMock.address,
        fraxETH,
        resilientOracleMock.address,
        true,
      );
    });
  });

  describe("getPrice", () => {
    it("revert if address is not valid sFrax or sfraxETH address", async () => {
      await expect(FraxOracle.getPrice(addr0000)).to.be.revertedWith("wrong sFRAX or sfraxETH asset address");
    });

    it("should get correct price of sFrax", async () => {
      resilientOracleMock.getPrice.returns(FRAX_USD_PRICE);
      const price = await FraxOracle.getPrice(sFraxMock.address);
      expect(price).to.equal(parseUnits("1.017054660529263597", 18));
    });

    it("should get correct price of sfraxETH", async () => {
      resilientOracleMock.getPrice.returns(ETH_USD_PRICE);
      const price = await FraxOracle.getPrice(sFraxETHMock.address);
      expect(price).to.equal(parseUnits("3337.2939864885263664", 18));
    });
  });
});
