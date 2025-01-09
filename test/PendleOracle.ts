import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { BEP20Harness, IPendlePtOracle, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { PTweETH_26DEC2024, PTweETH_26DEC2024_Market, PTOracle, eETH } = ADDRESSES.ethereum;
const eETH_PRICE = parseUnits("3400", 18);
const PRICE_DENOMINATOR = parseUnits("1", 18);
const EETH_AMOUNT_FOR_ONE_WEETH = parseUnits("0.923601422168630818", 18);
const DURATION = 3600; // 1 hour
const ANNUAL_GROWTH_RATE = parseUnits("0.05", 18); // 5% growth
const SNAPSHOT_UPDATE_INTERVAL = 10;

describe("PendleOracle unit tests", () => {
  let ptWeETHMock;
  let resilientOracleMock;
  let pendleOracle;
  let pendleOracleFactory;
  let ptOracleMock;
  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
    resilientOracleMock.getPrice.returns(eETH_PRICE);

    ptWeETHMock = await smock.fake<BEP20Harness>("BEP20Harness", { address: PTweETH_26DEC2024 });
    ptWeETHMock.decimals.returns(18);

    ptOracleMock = await smock.fake<IPendlePtOracle>("IPendlePtOracle", { address: PTOracle });
    ptOracleMock.getPtToAssetRate.returns(EETH_AMOUNT_FOR_ONE_WEETH);
    ptOracleMock.getOracleState.returns([false, 0, true]);

    pendleOracleFactory = await ethers.getContractFactory("PendleOracle");
  });

  describe("deployment", () => {
    it("revert if market address is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          addr0000,
          ptOracleMock.address,
          ptWeETHMock.address,
          eETH,
          resilientOracleMock.address,
          DURATION,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
        ),
      ).to.be.reverted;
    });
    it("revert if ptOracle address is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          PTweETH_26DEC2024_Market,
          addr0000,
          ptWeETHMock.address,
          eETH,
          resilientOracleMock.address,
          DURATION,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
        ),
      ).to.be.reverted;
    });
    it("revert if ptWeETH address is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          PTweETH_26DEC2024_Market,
          ptOracleMock.address,
          addr0000,
          eETH,
          resilientOracleMock.address,
          DURATION,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
        ),
      ).to.be.reverted;
    });
    it("revert if eETH address is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          PTweETH_26DEC2024_Market,
          ptOracleMock.address,
          ptWeETHMock.address,
          addr0000,
          resilientOracleMock.address,
          DURATION,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
        ),
      ).to.be.reverted;
    });
    it("revert if ResilientOracle address is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          PTweETH_26DEC2024_Market,
          ptOracleMock.address,
          ptWeETHMock.address,
          eETH,
          addr0000,
          DURATION,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
        ),
      ).to.be.reverted;
    });
    it("revert if TWAP duration is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          PTweETH_26DEC2024_Market,
          ptOracleMock.address,
          ptWeETHMock.address,
          eETH,
          resilientOracleMock.address,
          0,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
        ),
      ).to.be.reverted;
    });

    it("revert if invalid TWAP duration", async () => {
      ptOracleMock.getOracleState.returns([true, 0, true]);

      await expect(
        pendleOracleFactory.deploy(
          PTweETH_26DEC2024_Market,
          ptOracleMock.address,
          ptWeETHMock.address,
          eETH,
          resilientOracleMock.address,
          DURATION,
          ANNUAL_GROWTH_RATE,
          SNAPSHOT_UPDATE_INTERVAL,
        ),
      ).to.be.reverted;

      ptOracleMock.getOracleState.returns([false, 0, true]);
    });

    it("should deploy contract", async () => {
      pendleOracle = await pendleOracleFactory.deploy(
        PTweETH_26DEC2024_Market,
        ptOracleMock.address,
        ptWeETHMock.address,
        eETH,
        resilientOracleMock.address,
        DURATION,
        ANNUAL_GROWTH_RATE,
        SNAPSHOT_UPDATE_INTERVAL,
      );
    });
  });

  describe("getPrice", () => {
    it("revert if wstETH address is wrong", async () => {
      await expect(pendleOracle.getPrice(addr0000)).to.be.revertedWithCustomError(pendleOracle, "InvalidTokenAddress");
    });

    it("should get correct price", async () => {
      expect(await pendleOracle.getPrice(ptWeETHMock.address)).to.equal(parseUnits("3140.2448353733447812", 18));
    });
  });
});
