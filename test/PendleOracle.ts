import { FakeContract, smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { BEP20Harness, IPendlePtOracle, PendleOracle__factory, ResilientOracleInterface } from "../typechain-types";
import { addr0000, addr1111 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const UNDERLYING_PRICE = parseUnits("3400", 18);
const PT_TO_ASSET_RATE = parseUnits("0.923601422168630818", 18);
const PT_TO_SY_RATE = parseUnits("0.93", 18);
const DURATION = 3600; // 1 hour

enum PendleRateKind {
  PT_TO_ASSET,
  PT_TO_SY,
}

describe("PendleOracle unit tests", () => {
  const market = addr1111;
  let ptToken: FakeContract<BEP20Harness>;
  let underlyingToken: FakeContract<BEP20Harness>;
  let resilientOracleMock: FakeContract<ResilientOracleInterface>;
  let pendleOracleFactory: PendleOracle__factory;
  let ptOracleMock: FakeContract<IPendlePtOracle>;

  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
    resilientOracleMock.getPrice.returns(UNDERLYING_PRICE);

    ptToken = await smock.fake<BEP20Harness>("BEP20Harness");
    ptToken.decimals.returns(18);

    underlyingToken = await smock.fake<BEP20Harness>("BEP20Harness");
    underlyingToken.decimals.returns(18);

    ptOracleMock = await smock.fake<IPendlePtOracle>("IPendlePtOracle");
    ptOracleMock.getPtToAssetRate.returns(PT_TO_ASSET_RATE);
    ptOracleMock.getPtToSyRate.returns(PT_TO_SY_RATE);
    ptOracleMock.getOracleState.returns([false, 0, true]);

    pendleOracleFactory = await ethers.getContractFactory("PendleOracle");
  });

  describe("deployment", () => {
    it("revert if market address is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          addr0000,
          ptOracleMock.address,
          PendleRateKind.PT_TO_ASSET,
          ptToken.address,
          underlyingToken.address,
          resilientOracleMock.address,
          DURATION,
        ),
      ).to.be.reverted;
    });
    it("revert if ptOracle address is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          market,
          addr0000,
          PendleRateKind.PT_TO_ASSET,
          ptToken.address,
          underlyingToken.address,
          resilientOracleMock.address,
          DURATION,
        ),
      ).to.be.reverted;
    });
    it("revert if PT token address is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          market,
          ptOracleMock.address,
          PendleRateKind.PT_TO_ASSET,
          addr0000,
          underlyingToken.address,
          resilientOracleMock.address,
          DURATION,
        ),
      ).to.be.reverted;
    });
    it("revert if underlying token address is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          market,
          ptOracleMock.address,
          PendleRateKind.PT_TO_ASSET,
          ptToken.address,
          addr0000,
          resilientOracleMock.address,
          DURATION,
        ),
      ).to.be.reverted;
    });
    it("revert if ResilientOracle address is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          market,
          ptOracleMock.address,
          PendleRateKind.PT_TO_ASSET,
          ptToken.address,
          underlyingToken.address,
          addr0000,
          DURATION,
        ),
      ).to.be.reverted;
    });
    it("revert if TWAP duration is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          market,
          ptOracleMock.address,
          PendleRateKind.PT_TO_ASSET,
          ptToken.address,
          underlyingToken.address,
          resilientOracleMock.address,
          0,
        ),
      ).to.be.reverted;
    });

    it("revert if invalid TWAP duration", async () => {
      ptOracleMock.getOracleState.returns([true, 0, true]);

      await expect(
        pendleOracleFactory.deploy(
          market,
          ptOracleMock.address,
          PendleRateKind.PT_TO_ASSET,
          ptToken.address,
          underlyingToken.address,
          resilientOracleMock.address,
          DURATION,
        ),
      ).to.be.reverted;

      ptOracleMock.getOracleState.returns([false, 0, true]);
    });
  });

  describe("getPrice", () => {
    const deploy = (kind: PendleRateKind) =>
      pendleOracleFactory.deploy(
        market,
        ptOracleMock.address,
        kind,
        ptToken.address,
        underlyingToken.address,
        resilientOracleMock.address,
        DURATION,
      );

    it("revert if getPrice argument is not the configured PT token", async () => {
      const pendleOracle = await deploy(PendleRateKind.PT_TO_ASSET);
      await expect(pendleOracle.getPrice(addr1111)).to.be.revertedWithCustomError(pendleOracle, "InvalidTokenAddress");
    });

    it("should get correct price for PT_TO_ASSET rate kind", async () => {
      const pendleOracle = await deploy(PendleRateKind.PT_TO_ASSET);
      expect(await pendleOracle.getPrice(ptToken.address)).to.equal(parseUnits("3140.2448353733447812", 18));
    });

    it("should get correct price for PT_TO_SY rate kind", async () => {
      const pendleOracle = await deploy(PendleRateKind.PT_TO_SY);
      expect(await pendleOracle.getPrice(ptToken.address)).to.equal(parseUnits("3162.0", 18));
    });

    it("should adjust for underlying decimals", async () => {
      const underlyingTokenDecimals = 8;
      const ptTokenDecimals = 16;
      ptToken.decimals.returns(ptTokenDecimals);
      underlyingToken.decimals.returns(underlyingTokenDecimals);
      resilientOracleMock.getPrice.returns(parseUnits("3400", 36 - underlyingTokenDecimals));

      const pendleOracle = await deploy(PendleRateKind.PT_TO_SY);
      const expectedPriceDecimals = 36 - ptTokenDecimals;
      expect(await pendleOracle.getPrice(ptToken.address)).to.equal(parseUnits("3162.0", expectedPriceDecimals));
    });
  });
});
