import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { BEP20Harness, OracleInterface, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const LDO_ETH_PRICE = parseUnits("0.000945180903526149", 18); // 3.30 USD for 1 LDO
const ETH_USD_PRICE = parseUnits("3496.14", 18); // 3,496.14 USD for 1 ETH
const ANNUAL_GROWTH_RATE = parseUnits("0.05", 18); // 5% growth

describe("OneJumpOracle unit tests", () => {
  let ldoMock;
  let wethMock;
  let resilientOracleMock;
  let OneJumpOracleFactory;
  let OneJumpOracle;
  let chainlinkOracleMock;
  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
    chainlinkOracleMock = await smock.fake<OracleInterface>("OracleInterface");

    ldoMock = await smock.fake<BEP20Harness>("BEP20Harness");
    ldoMock.decimals.returns(18);

    wethMock = await smock.fake<BEP20Harness>("BEP20Harness");
    wethMock.decimals.returns(18);

    resilientOracleMock.getPrice.whenCalledWith(wethMock.address).returns(ETH_USD_PRICE.toString());
    chainlinkOracleMock.getPrice.whenCalledWith(ldoMock.address).returns(LDO_ETH_PRICE.toString());

    OneJumpOracleFactory = await ethers.getContractFactory("OneJumpOracle");
  });

  describe("deployment", () => {
    it("revert if correlated token address is 0", async () => {
      await expect(
        OneJumpOracleFactory.deploy(
          addr0000,
          wethMock.address,
          resilientOracleMock.address,
          chainlinkOracleMock.address,
          ANNUAL_GROWTH_RATE,
          ETH_USD_PRICE,
        ),
      ).to.be.reverted;
    });

    it("revert if underlying token address is 0", async () => {
      await expect(
        OneJumpOracleFactory.deploy(
          ldoMock.address,
          addr0000,
          resilientOracleMock.address,
          chainlinkOracleMock.address,
          ANNUAL_GROWTH_RATE,
          ETH_USD_PRICE,
        ),
      ).to.be.reverted;
    });

    it("revert if resilient oracle address is 0", async () => {
      await expect(
        OneJumpOracleFactory.deploy(
          ldoMock.address,
          wethMock.address,
          addr0000,
          chainlinkOracleMock.address,
          ANNUAL_GROWTH_RATE,
          ETH_USD_PRICE,
        ),
      ).to.be.reverted;
    });

    it("revert if intermediate oracle address is 0", async () => {
      await expect(
        OneJumpOracleFactory.deploy(
          ldoMock.address,
          wethMock.address,
          resilientOracleMock.address,
          addr0000,
          ANNUAL_GROWTH_RATE,
          ETH_USD_PRICE,
        ),
      ).to.be.reverted;
    });

    it("should deploy contract", async () => {
      OneJumpOracle = await OneJumpOracleFactory.deploy(
        ldoMock.address,
        wethMock.address,
        resilientOracleMock.address,
        chainlinkOracleMock.address,
        ANNUAL_GROWTH_RATE,
        ETH_USD_PRICE,
      );
    });
  });

  describe("getPrice", () => {
    it("revert if address is not valid LDO address", async () => {
      await expect(OneJumpOracle.getPrice(addr0000)).to.be.revertedWithCustomError(
        OneJumpOracle,
        "InvalidTokenAddress",
      );
    });

    it("should get correct price of LDO", async () => {
      const price = await OneJumpOracle.getPrice(ldoMock.address);
      expect(price).to.equal(parseUnits("3.304484764053910564", 18));
    });
  });
});
