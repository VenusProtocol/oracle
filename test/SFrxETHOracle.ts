import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { BEP20Harness, ISfrxEthFraxOracle, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { sfrxETH, FRAX } = ADDRESSES.ethereum;
const ETH_USD_PRICE = parseUnits("3100", 18); // 3100 USD for 1 ETH

describe("SFrxETHOracle unit tests", () => {
  let resilientOracleMock;
  let sfrxETHMock;
  let SFrxETHOracleFactory;
  let SFrxETHOracle;
  let fraxMock;
  let sfrxEthFraxOracleMock;
  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");

    // deploy MockSfrxEthFraxOracle
    const sfrxEthFraxOracleMockFactory = await ethers.getContractFactory("MockSfrxEthFraxOracle");
    sfrxEthFraxOracleMock = await sfrxEthFraxOracleMockFactory.deploy();
    await sfrxEthFraxOracleMock.deployed();
    await sfrxEthFraxOracleMock.setPrices(false, parseUnits("0.000306430391670677", 18), parseUnits("0.000309520800596522", 18));

    fraxMock = await smock.fake<BEP20Harness>("BEP20Harness", { address: FRAX });
    fraxMock.decimals.returns(18);

    sfrxETHMock = await smock.fake<BEP20Harness>("BEP20Harness", { address: sfrxETH });
    sfrxETHMock.decimals.returns(18);

    SFrxETHOracleFactory = await ethers.getContractFactory("SFrxETHOracle");
  });

  describe("deployment", () => {
    it("revert if frax address is 0", async () => {
      await expect(SFrxETHOracleFactory.deploy(sfrxEthFraxOracleMock.address, sfrxETHMock.address, addr0000, resilientOracleMock.address)).to.be
        .reverted;
    });
    it("revert if sfrxETH address is 0", async () => {
      await expect(SFrxETHOracleFactory.deploy(sfrxEthFraxOracleMock.address, addr0000, fraxMock.address, resilientOracleMock.address)).to.be
        .reverted;
    });

    it("revert if sfrxEthFraxOracle address is 0", async () => {
      await expect(SFrxETHOracleFactory.deploy(addr0000, sfrxETHMock.address, fraxMock.address, resilientOracleMock.address)).to.be
        .reverted;
    });
    it("should deploy contract", async () => {
      SFrxETHOracle = await SFrxETHOracleFactory.deploy(
        sfrxEthFraxOracleMock.address,
        sfrxETHMock.address,
        fraxMock.address,
        resilientOracleMock.address,
      );
    });
  });

  describe("getPrice", () => {
    it("revert if address is not valid sfrxETH address", async () => {
      await expect(SFrxETHOracle.getPrice(addr0000)).to.be.revertedWithCustomError(
        SFrxETHOracle,
        "InvalidTokenAddress",
      );
    });

    it("should get correct price of sfrxETH", async () => {
      resilientOracleMock.getPrice.returns(parseUnits("0.99838881", 18));
      const price = await SFrxETHOracle.getPrice(sfrxETHMock.address);
      expect(price).to.equal(parseUnits("3241.778967340326445028", 18));
    });
  });
});
