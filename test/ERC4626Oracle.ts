import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { AccessControlManager, BEP20Harness, IERC4626, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { FRAX, sFRAX } = ADDRESSES.ethereum;
const FRAX_USD_PRICE = parseUnits("0.9979", 18); // 0.99 USD for 1 FRAX
const ANNUAL_GROWTH_RATE = parseUnits("0.05", 18); // 5% growth
const SNAPSHOT_UPDATE_INTERVAL = 10;
const exchangeRate = parseUnits("1.019194969966192602", 18);

describe("ERC4626Oracle unit tests", () => {
  let sFraxMock;
  let resilientOracleMock;
  let ERC4626OracleFactory;
  let ERC4626Oracle;
  let fraxMock;
  let timestamp;
  let acm;
  before(async () => {
    ({ timestamp } = await ethers.provider.getBlock("latest"));

    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");

    sFraxMock = await smock.fake<IERC4626>("IERC4626", { address: sFRAX });
    sFraxMock.convertToAssets.returns(exchangeRate);
    sFraxMock.decimals.returns(18);

    fraxMock = await smock.fake<BEP20Harness>("BEP20Harness", { address: FRAX });
    fraxMock.decimals.returns(18);

    ERC4626OracleFactory = await ethers.getContractFactory("ERC4626Oracle");

    const fakeAccessControlManager = await smock.fake<AccessControlManager>("AccessControlManager");
    fakeAccessControlManager.isAllowedToCall.returns(true);

    acm = fakeAccessControlManager.address;
  });

  describe("deployment", () => {
    it("revert if FRAX address is 0", async () => {
      await expect(
        ERC4626OracleFactory.deploy(
          sFraxMock.address,
          addr0000,
          resilientOracleMock.address,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
          exchangeRate,
          timestamp,
          acm,
          0,
        ),
      ).to.be.reverted;
    });
    it("revert if sFRAX address is 0", async () => {
      await expect(
        ERC4626OracleFactory.deploy(
          addr0000,
          fraxMock.address,
          resilientOracleMock.address,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
          exchangeRate,
          timestamp,
          acm,
          0,
        ),
      ).to.be.reverted;
    });
    it("should deploy contract", async () => {
      ERC4626Oracle = await ERC4626OracleFactory.deploy(
        sFraxMock.address,
        fraxMock.address,
        resilientOracleMock.address,
        ANNUAL_GROWTH_RATE,
        SNAPSHOT_UPDATE_INTERVAL,
        exchangeRate,
        timestamp,
        acm,
        0,
      );
    });
  });

  describe("getPrice", () => {
    it("revert if address is not valid sFrax address", async () => {
      await expect(ERC4626Oracle.getPrice(addr0000)).to.be.revertedWithCustomError(
        ERC4626Oracle,
        "InvalidTokenAddress",
      );
    });

    it("should get correct price of sFrax", async () => {
      resilientOracleMock.getPrice.returns(FRAX_USD_PRICE);
      const price = await ERC4626Oracle.getPrice(sFraxMock.address);
      expect(price).to.equal(parseUnits("1.017054660529263597", 18));
    });

    it("cache exchange rate in transient storage", async () => {
      const MockCallPrice = await ethers.getContractFactory("MockCallPrice");
      const mockCallPrice = await MockCallPrice.deploy();

      let prev = parseUnits("1.019194969966192602", 18);
      sFraxMock.convertToAssets.returns(() => {
        prev = prev.add(parseUnits("1", 18));
        return prev;
      });

      const prices = await mockCallPrice.callStatic.getMultiPrice(ERC4626Oracle.address, sFraxMock.address);
      expect(prices[0]).to.equal(parseUnits("1.017054663754322768", 18));
      expect(prices[1]).to.equal(parseUnits("1.017054663754322768", 18));
    });
  });
});
