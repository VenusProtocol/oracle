import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { BEP20Harness, ISFrax, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { FRAX, sFRAX } = ADDRESSES.ethereum;
const FRAX_USD_PRICE = parseUnits("0.9979", 18); // 0.99 USD for 1 FRAX

describe("SFraxOracle unit tests", () => {
  let sFraxMock;
  let resilientOracleMock;
  let SFraxOracleFactory;
  let SFraxOracle;
  let fraxMock;
  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");

    sFraxMock = await smock.fake<ISFrax>("ISFrax", { address: sFRAX });
    sFraxMock.convertToAssets.returns(parseUnits("1.019194969966192602", 18));
    sFraxMock.decimals.returns(18);

    fraxMock = await smock.fake<BEP20Harness>("BEP20Harness", { address: FRAX });
    fraxMock.decimals.returns(18);

    SFraxOracleFactory = await ethers.getContractFactory("SFraxOracle");
  });

  describe("deployment", () => {
    it("revert if FRAX address is 0", async () => {
      await expect(SFraxOracleFactory.deploy(sFraxMock.address, addr0000, resilientOracleMock.address)).to.be.reverted;
    });
    it("revert if sFRAX address is 0", async () => {
      await expect(SFraxOracleFactory.deploy(addr0000, fraxMock.address, resilientOracleMock.address)).to.be.reverted;
    });
    it("should deploy contract", async () => {
      SFraxOracle = await SFraxOracleFactory.deploy(sFraxMock.address, fraxMock.address, resilientOracleMock.address);
    });
  });

  describe("getPrice", () => {
    it("revert if address is not valid sFrax address", async () => {
      await expect(SFraxOracle.getPrice(addr0000)).to.be.revertedWithCustomError(SFraxOracle, "InvalidTokenAddress");
    });

    it("should get correct price of sFrax", async () => {
      resilientOracleMock.getPrice.returns(FRAX_USD_PRICE);
      const price = await SFraxOracle.getPrice(sFraxMock.address);
      expect(price).to.equal(parseUnits("1.017054660529263597", 18));
    });
  });
});
