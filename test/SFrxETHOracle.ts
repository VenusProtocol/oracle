import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { AccessControlManager, BEP20Harness, SFrxETHOracle } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { sfrxETH } = ADDRESSES.ethereum;

describe("SFrxETHOracle unit tests", () => {
  let sfrxETHMock;
  let SFrxETHOracleFactory;
  let SFrxETHOracleContract;
  let sfrxEthFraxOracleMock;
  let fakeAccessControlManager;
  const priceDifference = parseUnits("300", 18);
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
      await expect(
        upgrades.deployProxy(SFrxETHOracleFactory, [fakeAccessControlManager.address], {
          constructorArgs: [addr0000, sfrxETHMock.address, priceDifference],
        }),
      ).to.be.reverted;
    });
    it("revert if sfrxETH address is 0", async () => {
      await expect(
        upgrades.deployProxy(SFrxETHOracleFactory, [fakeAccessControlManager.address], {
          constructorArgs: [sfrxEthFraxOracleMock.address, addr0000, priceDifference],
        }),
      ).to.be.reverted;
    });
    it("revert if price different is 0", async () => {
      await expect(
        upgrades.deployProxy(SFrxETHOracleFactory, [fakeAccessControlManager.address], {
          constructorArgs: [sfrxEthFraxOracleMock.address, sfrxETHMock.address, 0],
        }),
      ).to.be.reverted;
    });
    it("should deploy contract", async () => {
      SFrxETHOracleContract = <SFrxETHOracle>await upgrades.deployProxy(
        SFrxETHOracleFactory,
        [fakeAccessControlManager.address],
        {
          constructorArgs: [sfrxEthFraxOracleMock.address, sfrxETHMock.address, priceDifference],
        },
      );
    });
  });

  describe("getPrice", () => {
    it("revert if address is not valid sfrxETH address", async () => {
      await expect(SFrxETHOracleContract.getPrice(addr0000)).to.be.revertedWithCustomError(
        SFrxETHOracleContract,
        "InvalidTokenAddress",
      );
    });

    it("revert if price difference is more than allowed", async () => {
      await SFrxETHOracleContract.setMaxAllowedPriceDifference(parseUnits("1", 18));
      await expect(SFrxETHOracleContract.getPrice(sfrxETHMock.address)).to.be.revertedWithCustomError(
        SFrxETHOracleContract,
        "PriceDifferenceExceeded",
      );
    });

    it("should get correct price of sfrxETH", async () => {
      await SFrxETHOracleContract.setMaxAllowedPriceDifference(priceDifference);
      const price = await SFrxETHOracleContract.getPrice(sfrxETHMock.address);
      expect(price).to.equal(parseUnits("3247.092258084175122617", 18));
    });
  });
});
