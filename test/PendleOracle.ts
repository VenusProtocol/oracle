import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { BEP20Harness, IPendlePtOracle, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { PTweETH, PTweETHMarket, PTOracle, eETH } = ADDRESSES.ethereum;
const eETH_PRICE = parseUnits("3400", 18);
const PRICE_DENOMINATOR = parseUnits("1", 18);
const EETH_AMOUNT_FOR_ONE_WEETH = parseUnits("0.923601422168630818", 18);
const DURATION = 3600; // 1 hour

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

    ptWeETHMock = await smock.fake<BEP20Harness>("BEP20Harness", { address: PTweETH });
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
        ),
      ).to.be.reverted;
    });
    it("revert if ptOracle address is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          PTweETHMarket,
          addr0000,
          ptWeETHMock.address,
          eETH,
          resilientOracleMock.address,
          DURATION,
        ),
      ).to.be.reverted;
    });
    it("revert if ptWeETH address is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          PTweETHMarket,
          ptOracleMock.address,
          addr0000,
          eETH,
          resilientOracleMock.address,
          DURATION,
        ),
      ).to.be.reverted;
    });
    it("revert if eETH address is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          PTweETHMarket,
          ptOracleMock.address,
          ptWeETHMock.address,
          addr0000,
          resilientOracleMock.address,
          DURATION,
        ),
      ).to.be.reverted;
    });
    it("revert if ResilientOracle address is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(PTweETHMarket, ptOracleMock.address, ptWeETHMock.address, eETH, addr0000, DURATION),
      ).to.be.reverted;
    });
    it("revert if TWAP duration is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          PTweETHMarket,
          ptOracleMock.address,
          ptWeETHMock.address,
          eETH,
          resilientOracleMock.address,
          0,
        ),
      ).to.be.reverted;
    });

    it("revert if invalid TWAP duration", async () => {
      ptOracleMock.getOracleState.returns([true, 0, true]);

      await expect(
        pendleOracleFactory.deploy(
          PTweETHMarket,
          ptOracleMock.address,
          ptWeETHMock.address,
          eETH,
          resilientOracleMock.address,
          DURATION,
        ),
      ).to.be.reverted;

      ptOracleMock.getOracleState.returns([false, 0, true]);
    });

    it("should deploy contract", async () => {
      pendleOracle = await pendleOracleFactory.deploy(
        PTweETHMarket,
        ptOracleMock.address,
        ptWeETHMock.address,
        eETH,
        resilientOracleMock.address,
        DURATION,
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
