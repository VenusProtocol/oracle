import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { AccessControlManager, OracleInterface } from "../typechain-types";

const { expect } = chai;
chai.use(smock.matchers);

/**
 * PriceCircuitBreaker unit tests
 *
 * Proves that the circuit breaker would have blocked the THE token attack
 * (March 2026) where THE price crashed from $0.528 to $0.237 (-55%)
 * while the attacker had borrowed against THE collateral.
 */
describe("PriceCircuitBreaker", () => {
  let underlyingOracle: any;
  let circuitBreaker: any;
  let acm: any;
  const ASSET = "0xF4C8E32EaDEC4BFe97E0F595AdD0f4450a863a11"; // THE token

  before(async () => {
    await ethers.getSigners();

    underlyingOracle = await smock.fake<OracleInterface>("OracleInterface");
    acm = await smock.fake<AccessControlManager>("AccessControlManager");
    acm.isAllowedToCall.returns(true);

    const Factory = await ethers.getContractFactory("PriceCircuitBreaker");
    circuitBreaker = await Factory.deploy(underlyingOracle.address, acm.address);

    // Configure THE with 30% max drop, 1 hour window
    await circuitBreaker.setAssetConfig(ASSET, 3000, 3600);
  });

  describe("Normal operation", () => {
    it("returns price when no previous snapshot", async () => {
      underlyingOracle.getPrice.returns(parseUnits("0.528", 18));
      const price = await circuitBreaker.getPrice(ASSET);
      expect(price).to.equal(parseUnits("0.528", 18));
    });

    it("records price snapshot", async () => {
      underlyingOracle.getPrice.returns(parseUnits("0.528", 18));
      await circuitBreaker.updatePriceSnapshot(ASSET);
      const config = await circuitBreaker.assetConfigs(ASSET);
      expect(config.lastPrice).to.equal(parseUnits("0.528", 18));
    });

    it("allows small price drops (<30%)", async () => {
      // 10% drop: $0.528 → $0.475
      underlyingOracle.getPrice.returns(parseUnits("0.475", 18));
      const price = await circuitBreaker.getPrice(ASSET);
      expect(price).to.equal(parseUnits("0.475", 18));
    });

    it("allows price increases", async () => {
      underlyingOracle.getPrice.returns(parseUnits("0.60", 18));
      const price = await circuitBreaker.getPrice(ASSET);
      expect(price).to.equal(parseUnits("0.60", 18));
    });
  });

  describe("THE attack simulation", () => {
    it("BLOCKS price when drop exceeds 30% threshold", async () => {
      // Reset snapshot at $0.528
      underlyingOracle.getPrice.returns(parseUnits("0.528", 18));
      await circuitBreaker.updatePriceSnapshot(ASSET);

      // THE crashes to $0.237 (-55%) within 1 hour
      underlyingOracle.getPrice.returns(parseUnits("0.237", 18));

      await expect(circuitBreaker.getPrice(ASSET)).to.be.revertedWithCustomError(
        circuitBreaker,
        "CircuitBreakerActive",
      );
    });

    it("trips circuit breaker on updatePriceSnapshot", async () => {
      // Reset first
      await circuitBreaker.resetCircuitBreaker(ASSET);
      underlyingOracle.getPrice.returns(parseUnits("0.528", 18));
      await circuitBreaker.updatePriceSnapshot(ASSET);

      // Price crashes - updatePriceSnapshot sets tripped=true and returns
      underlyingOracle.getPrice.returns(parseUnits("0.237", 18));
      await circuitBreaker.updatePriceSnapshot(ASSET);

      // Now getPrice should revert
      await expect(circuitBreaker.getPrice(ASSET)).to.be.revertedWithCustomError(
        circuitBreaker,
        "CircuitBreakerActive",
      );
    });

    it("stays tripped until governance resets", async () => {
      // Still tripped from previous test
      const config = await circuitBreaker.assetConfigs(ASSET);
      expect(config.tripped).to.be.true;

      // Any price query reverts
      underlyingOracle.getPrice.returns(parseUnits("0.528", 18));
      await expect(circuitBreaker.getPrice(ASSET)).to.be.revertedWithCustomError(
        circuitBreaker,
        "CircuitBreakerActive",
      );
    });

    it("governance can reset circuit breaker", async () => {
      await circuitBreaker.resetCircuitBreaker(ASSET);
      const config = await circuitBreaker.assetConfigs(ASSET);
      expect(config.tripped).to.be.false;

      underlyingOracle.getPrice.returns(parseUnits("0.40", 18));
      const price = await circuitBreaker.getPrice(ASSET);
      expect(price).to.equal(parseUnits("0.40", 18));
    });
  });

  describe("Allows drops after window expires", () => {
    it("allows large drops after time window passes", async () => {
      // Set snapshot at $0.528
      underlyingOracle.getPrice.returns(parseUnits("0.528", 18));
      await circuitBreaker.updatePriceSnapshot(ASSET);

      // Fast forward past the 1 hour window
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      // Now a 55% drop is allowed (outside the window)
      underlyingOracle.getPrice.returns(parseUnits("0.237", 18));
      const price = await circuitBreaker.getPrice(ASSET);
      expect(price).to.equal(parseUnits("0.237", 18));
    });
  });
});
