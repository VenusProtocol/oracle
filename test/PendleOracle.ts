import { FakeContract, smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import {
  BEP20Harness,
  IPendlePtOracle,
  PendleOracle__factory,
  ResilientOracleInterface,
} from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { PTweETH_26DEC2024, PTweETH_26DEC2024_Market, PTOracle, eETH } = ADDRESSES.ethereum;
const eETH_PRICE = parseUnits("3400", 18);
const PT_TO_ASSET_RATE = parseUnits("0.923601422168630818", 18);
const PT_TO_SY_RATE = parseUnits("0.93", 18);
const DURATION = 3600; // 1 hour

enum PendleRateKind {
  PT_TO_ASSET,
  PT_TO_SY,
}

describe("PendleOracle unit tests", () => {
  let ptWeETHMock: FakeContract<BEP20Harness>;
  let resilientOracleMock: FakeContract<ResilientOracleInterface>;
  let pendleOracleFactory: PendleOracle__factory;
  let ptOracleMock: FakeContract<IPendlePtOracle>;

  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
    resilientOracleMock.getPrice.returns(eETH_PRICE);

    ptWeETHMock = await smock.fake<BEP20Harness>("BEP20Harness", { address: PTweETH_26DEC2024 });
    ptWeETHMock.decimals.returns(18);

    ptOracleMock = await smock.fake<IPendlePtOracle>("IPendlePtOracle", { address: PTOracle });
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
          PTweETH_26DEC2024_Market,
          addr0000,
          PendleRateKind.PT_TO_ASSET,
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
          PTweETH_26DEC2024_Market,
          ptOracleMock.address,
          PendleRateKind.PT_TO_ASSET,
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
          PTweETH_26DEC2024_Market,
          ptOracleMock.address,
          PendleRateKind.PT_TO_ASSET,
          ptWeETHMock.address,
          addr0000,
          resilientOracleMock.address,
          DURATION,
        ),
      ).to.be.reverted;
    });
    it("revert if ResilientOracle address is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          PTweETH_26DEC2024_Market,
          ptOracleMock.address,
          PendleRateKind.PT_TO_ASSET,
          ptWeETHMock.address,
          eETH,
          addr0000,
          DURATION,
        ),
      ).to.be.reverted;
    });
    it("revert if TWAP duration is 0", async () => {
      await expect(
        pendleOracleFactory.deploy(
          PTweETH_26DEC2024_Market,
          ptOracleMock.address,
          PendleRateKind.PT_TO_ASSET,
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
          PTweETH_26DEC2024_Market,
          ptOracleMock.address,
          PendleRateKind.PT_TO_ASSET,
          ptWeETHMock.address,
          eETH,
          resilientOracleMock.address,
          DURATION,
        ),
      ).to.be.reverted;

      ptOracleMock.getOracleState.returns([false, 0, true]);
    });
  });

  describe("getPrice", () => {
    const deploy = (kind: PendleRateKind) => {
      return pendleOracleFactory.deploy(
        PTweETH_26DEC2024_Market,
        ptOracleMock.address,
        kind,
        ptWeETHMock.address,
        eETH,
        resilientOracleMock.address,
        DURATION,
      );
    };

    it("revert if wstETH address is wrong", async () => {
      const pendleOracle = await deploy(PendleRateKind.PT_TO_ASSET);
      await expect(pendleOracle.getPrice(addr0000)).to.be.revertedWithCustomError(pendleOracle, "InvalidTokenAddress");
    });

    it("should get correct price for PT_TO_ASSET rate kind", async () => {
      const pendleOracle = await deploy(PendleRateKind.PT_TO_ASSET);
      expect(await pendleOracle.getPrice(ptWeETHMock.address)).to.equal(parseUnits("3140.2448353733447812", 18));
    });

    it("should get correct price for PT_TO_SY rate kind", async () => {
      const pendleOracle = await deploy(PendleRateKind.PT_TO_SY);
      expect(await pendleOracle.getPrice(ptWeETHMock.address)).to.equal(parseUnits("3162.0", 18));
    });
  });
});
