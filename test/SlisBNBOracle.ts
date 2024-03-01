import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { ISynclubStakeManager, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { slisBNB } = ADDRESSES.bscmainnet;
const EXP_SCALE = parseUnits("1", 18);
const BNB_USD_PRICE = parseUnits("300", 18); // 300 USD for 1 BNB
const BNB_FOR_ONE_SLISBNB = parseUnits("1.014061147834812261", 18);
const BNB = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";

describe("SlisBNBOracle unit tests", () => {
  let SynclubManagerMock;
  let resilientOracleMock;
  let SlisBNBOracle;
  let SlisBNBOracleFactory;
  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
    resilientOracleMock.getPrice.returns(BNB_USD_PRICE);

    SynclubManagerMock = await smock.fake<ISynclubStakeManager>("ISynclubStakeManager");
    SynclubManagerMock.convertSnBnbToBnb.returns(BNB_FOR_ONE_SLISBNB);
    SlisBNBOracleFactory = await ethers.getContractFactory("SlisBNBOracle");
  });

  describe("deployment", () => {
    it("revert if SynclubManager address is 0", async () => {
      await expect(SlisBNBOracleFactory.deploy(addr0000, slisBNB, BNB, resilientOracleMock.address)).to.be.reverted;
    });
    it("revert if slisBNB address is 0", async () => {
      await expect(SlisBNBOracleFactory.deploy(SynclubManagerMock.address, addr0000, BNB, resilientOracleMock.address)).to.be
        .reverted;
    });
    it("revert if resilientOracle address is 0", async () => {
      await expect(SlisBNBOracleFactory.deploy(SynclubManagerMock.address, slisBNB, BNB, addr0000)).to.be.reverted;
    });
    it("should deploy contract", async () => {
      SlisBNBOracle = await SlisBNBOracleFactory.deploy(
        SynclubManagerMock.address,
        slisBNB,
        BNB,
        resilientOracleMock.address,
      );
    });
  });

  describe("getPrice", () => {
    it("revert if slisBNB address is wrong", async () => {
      await expect(SlisBNBOracle.getPrice(addr0000)).to.be.revertedWith("wrong token address");
    });

    it("should get correct price", async () => {
      const expectedPrice = BNB_FOR_ONE_SLISBNB.mul(BNB_USD_PRICE).div(EXP_SCALE);
      expect(await SlisBNBOracle.getPrice(slisBNB)).to.equal(expectedPrice);
    });
  });
});
