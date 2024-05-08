import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { AccessControlManager, BEP20Harness } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { sfrxETH } = ADDRESSES.ethereum;

describe("SFrxETHOracle unit tests", () => {
  let sfrxETHMock;
  let SFrxETHOracleFactory;
  let SFrxETHOracle;
  let sfrxEthFraxOracleMock;
  let fakeAccessControlManager;
  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();

    // deploy MockSfrxEthFraxOracle
    const sfrxEthFraxOracleMockFactory = await ethers.getContractFactory("MockSfrxEthFraxOracle");
    sfrxEthFraxOracleMock = await sfrxEthFraxOracleMockFactory.deploy();
    await sfrxEthFraxOracleMock.deployed();
    await sfrxEthFraxOracleMock.setPrices(
      false,
      parseUnits("0.000306430391670677", 18),
      parseUnits("0.000309520800596522", 18),
    );

    sfrxETHMock = await smock.fake<BEP20Harness>("BEP20Harness", { address: sfrxETH });
    sfrxETHMock.decimals.returns(18);

    SFrxETHOracleFactory = await ethers.getContractFactory("SFrxETHOracle");

    fakeAccessControlManager = await smock.fake<AccessControlManager>("AccessControlManagerScenario");
    fakeAccessControlManager.isAllowedToCall.returns(true);
  });

  describe("deployment", () => {
    it("revert if SfrxEthFraxOracle address is 0", async () => {
      await expect(SFrxETHOracleFactory.deploy(addr0000, sfrxETHMock.address)).to.be.reverted;
    });
    it("revert if sfrxETH address is 0", async () => {
      await expect(SFrxETHOracleFactory.deploy(sfrxEthFraxOracleMock.address, addr0000)).to.be.reverted;
    });
    it("should deploy contract", async () => {
      SFrxETHOracle = await SFrxETHOracleFactory.deploy(sfrxEthFraxOracleMock.address, sfrxETHMock.address);

      await SFrxETHOracle.initialize(fakeAccessControlManager.address);
    });
  });

  describe("getPrice", () => {
    it("revert if address is not valid sfrxETH address", async () => {
      await expect(SFrxETHOracle.getPrice(addr0000)).to.be.revertedWithCustomError(
        SFrxETHOracle,
        "InvalidTokenAddress",
      );
    });

    it("revert if price difference is more than allowed", async () => {
      await SFrxETHOracle.setMaxAllowedPriceDifference(parseUnits("1", 18));
      await expect(SFrxETHOracle.getPrice(sfrxETHMock.address)).to.be.revertedWithCustomError(
        SFrxETHOracle,
        "PriceDifferenceExceeded",
      );
    });

    it("should get correct price of sfrxETH", async () => {
      await SFrxETHOracle.setMaxAllowedPriceDifference(parseUnits("300", 18));
      const price = await SFrxETHOracle.getPrice(sfrxETHMock.address);
      expect(price).to.equal(parseUnits("3247.092258084175122617", 18));
    });
  });
});
