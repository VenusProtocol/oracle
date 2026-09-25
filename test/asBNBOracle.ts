import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { BEP20Harness, IAsBNBMinter, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { asBNB, slisBNB } = ADDRESSES.bscmainnet;
const slisBNB_USD_PRICE = parseUnits("300", 18); // 300 USD for 1 slisBNB
const slisBNB_FOR_ONE_asBNB = parseUnits("1.082798704659082054", 18);
const ANNUAL_GROWTH_RATE = parseUnits("0.05", 18); // 5% growth
const SNAPSHOT_UPDATE_INTERVAL = 10;

describe("AsBNBOracle unit tests", () => {
  let asBNBMinterMock;
  let resilientOracleMock;
  let asBNBOracle;
  let asBNBOracleFactory;
  let asBNBMock;
  let slisBNBMock;
  let timestamp;
  let acm;
  before(async () => {
    ({ timestamp } = await ethers.provider.getBlock("latest"));

    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
    resilientOracleMock.getPrice.returns(slisBNB_USD_PRICE);

    asBNBMinterMock = await smock.fake<IAsBNBMinter>("IAsBNBMinter");
    asBNBMinterMock.convertToTokens.returns(slisBNB_FOR_ONE_asBNB);

    asBNBMock = await smock.fake<BEP20Harness>("IAsBNB", { address: asBNB });
    asBNBMock.decimals.returns(18);
    asBNBMock.minter.returns(asBNBMinterMock.address);

    asBNBOracleFactory = await ethers.getContractFactory("AsBNBOracle");

    slisBNBMock = await smock.fake<BEP20Harness>("BEP20Harness", { address: slisBNB });
    slisBNBMock.decimals.returns(18);

    const fakeAccessControlManager = await smock.fake<AccessControlManager>("AccessControlManager");
    fakeAccessControlManager.isAllowedToCall.returns(true);

    acm = fakeAccessControlManager.address;
  });

  describe("deployment", () => {
    it("revert if asBNB address is 0", async () => {
      await expect(
        asBNBOracleFactory.deploy(
          addr0000,
          slisBNBMock.address,
          resilientOracleMock.address,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
          slisBNB_FOR_ONE_asBNB,
          timestamp,
          acm,
          0,
        ),
      ).to.be.reverted;
    });
    it("revert if slisBNB address is 0", async () => {
      await expect(
        asBNBOracleFactory.deploy(
          asBNBMock.address,
          addr0000,
          resilientOracleMock.address,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
          slisBNB_FOR_ONE_asBNB,
          timestamp,
          acm,
          0,
        ),
      ).to.be.reverted;
    });
    it("should deploy contract", async () => {
      asBNBOracle = await asBNBOracleFactory.deploy(
        asBNBMock.address,
        slisBNBMock.address,
        resilientOracleMock.address,
        ANNUAL_GROWTH_RATE,
        SNAPSHOT_UPDATE_INTERVAL,
        slisBNB_FOR_ONE_asBNB,
        timestamp,
        acm,
        0,
      );
    });
  });

  describe("getPrice", () => {
    it("revert if asBNB address is wrong", async () => {
      await expect(asBNBOracle.getPrice(addr0000)).to.be.revertedWithCustomError(asBNBOracle, "InvalidTokenAddress");
    });

    it("should get correct price", async () => {
      expect(await asBNBOracle.getPrice(asBNB)).to.equal(parseUnits("324.839611397724616200", 18));
    });
  });
});
