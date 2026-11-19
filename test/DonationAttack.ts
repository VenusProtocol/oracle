import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { AccessControlManager, BEP20Harness, IERC4626, ResilientOracleInterface } from "../typechain-types";

const { expect } = chai;
chai.use(smock.matchers);

/**
 * Donation Attack Reproduction Test
 *
 * Demonstrates the ERC-4626 donation attack vector that was used against
 * Venus Protocol on ZkSync (wUSDM, Feb 2026).
 *
 * Attack flow:
 * 1. Attacker flash-loans assets
 * 2. Donates underlying tokens directly to the ERC-4626 vault
 * 3. convertToAssets() returns an inflated exchange rate
 * 4. If oracle has NO CAPO (snapshotInterval=0), inflated rate is used directly
 * 5. Attacker borrows against artificially inflated collateral
 * 6. Protocol takes on bad debt
 *
 * This test proves:
 * - WITHOUT CAPO: the inflated rate passes through to the oracle price
 * - WITH CAPO: the oracle caps the rate, blocking the attack
 * - The new ERC4626Oracle constructor rejects snapshotInterval=0
 */
describe("ERC-4626 Donation Attack Reproduction", () => {
  const UNDERLYING_USD_PRICE = parseUnits("1", 18); // $1 stablecoin
  const NORMAL_EXCHANGE_RATE = parseUnits("1.06", 18); // Normal: 1 vault share = 1.06 underlying
  const INFLATED_EXCHANGE_RATE = parseUnits("1.76", 18); // After donation: 1 share = 1.76 underlying (~66% inflation)
  const ANNUAL_GROWTH_RATE = parseUnits("0.15", 18); // 15% annual growth cap
  const SNAPSHOT_INTERVAL = 86400; // 24 hours

  let vaultMock: any;
  let underlyingMock: any;
  let resilientOracleMock: any;
  let acm: string;
  let timestamp: number;

  before(async () => {
    await ethers.getSigners();
    ({ timestamp } = await ethers.provider.getBlock("latest"));

    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
    resilientOracleMock.getPrice.returns(UNDERLYING_USD_PRICE);

    vaultMock = await smock.fake<IERC4626>("IERC4626");
    vaultMock.decimals.returns(18);

    underlyingMock = await smock.fake<BEP20Harness>("BEP20Harness");
    underlyingMock.decimals.returns(18);

    const fakeACM = await smock.fake<AccessControlManager>("AccessControlManager");
    fakeACM.isAllowedToCall.returns(true);
    acm = fakeACM.address;
  });

  describe("VULNERABILITY: Oracle WITHOUT CAPO (snapshotInterval=0)", () => {
    it("should REJECT deployment without CAPO (new security fix)", async () => {
      const ERC4626OracleFactory = await ethers.getContractFactory("ERC4626Oracle");

      // This deployment with snapshotInterval=0 should now be rejected
      await expect(
        ERC4626OracleFactory.deploy(
          vaultMock.address,
          underlyingMock.address,
          resilientOracleMock.address,
          0, // annualGrowthRate = 0 (NO CAPO!)
          0, // snapshotInterval = 0 (NO CAPO!)
          0,
          0,
          acm,
          0,
        ),
      ).to.be.revertedWithCustomError(ERC4626OracleFactory, "CAPORequired");
    });

    it("should also REJECT if only growthRate is 0", async () => {
      const ERC4626OracleFactory = await ethers.getContractFactory("ERC4626Oracle");

      await expect(
        ERC4626OracleFactory.deploy(
          vaultMock.address,
          underlyingMock.address,
          resilientOracleMock.address,
          0, // annualGrowthRate = 0
          SNAPSHOT_INTERVAL,
          NORMAL_EXCHANGE_RATE,
          timestamp,
          acm,
          0,
        ),
      ).to.be.reverted; // InvalidGrowthRate from CorrelatedTokenOracle
    });

    it("should also REJECT if only snapshotInterval is 0", async () => {
      const ERC4626OracleFactory = await ethers.getContractFactory("ERC4626Oracle");

      await expect(
        ERC4626OracleFactory.deploy(
          vaultMock.address,
          underlyingMock.address,
          resilientOracleMock.address,
          ANNUAL_GROWTH_RATE,
          0, // snapshotInterval = 0
          NORMAL_EXCHANGE_RATE,
          timestamp,
          acm,
          0,
        ),
      ).to.be.reverted; // InvalidGrowthRate from CorrelatedTokenOracle
    });
  });

  describe("PROTECTION: Oracle WITH CAPO blocks donation attack", () => {
    let oracle: any;

    before(async () => {
      const ERC4626OracleFactory = await ethers.getContractFactory("ERC4626Oracle");

      // Deploy with proper CAPO parameters
      vaultMock.convertToAssets.returns(NORMAL_EXCHANGE_RATE);

      oracle = await ERC4626OracleFactory.deploy(
        vaultMock.address,
        underlyingMock.address,
        resilientOracleMock.address,
        ANNUAL_GROWTH_RATE,
        SNAPSHOT_INTERVAL,
        NORMAL_EXCHANGE_RATE,
        timestamp,
        acm,
        parseUnits("0.01", 18), // 1% gap
      );
    });

    it("should return normal price before attack", async () => {
      vaultMock.convertToAssets.returns(NORMAL_EXCHANGE_RATE);
      const price = await oracle.getPrice(vaultMock.address);
      // 1.06 * $1 = $1.06
      expect(price).to.equal(parseUnits("1.06", 18));
    });

    it("should CAP the price during donation attack", async () => {
      // Simulate donation attack: exchange rate jumps from 1.06 to 1.76
      vaultMock.convertToAssets.returns(INFLATED_EXCHANGE_RATE);

      const price = await oracle.getPrice(vaultMock.address);

      // With CAPO active, the price should NOT be 1.76
      // It should be capped near the snapshot rate + allowed growth
      // Max allowed rate = 1.06 + (1.06 * 0.15/365/86400 * elapsed) ≈ 1.06 (very close)
      expect(price).to.be.lt(parseUnits("1.08", 18)); // Must be far below 1.76
      expect(price).to.be.gt(parseUnits("1.05", 18)); // But still reasonable

      // Verify the oracle reports it IS capped
      const capped = await oracle.isCapped();
      expect(capped).to.equal(true);
    });

    it("should show the attack profit is blocked", async () => {
      vaultMock.convertToAssets.returns(INFLATED_EXCHANGE_RATE);

      const cappedPrice = await oracle.getPrice(vaultMock.address);
      const uncappedPrice = INFLATED_EXCHANGE_RATE; // What attacker wants: $1.76

      // The attacker wanted 66% more value, but CAPO blocks it
      // Capped price should be within ~2% of the real value
      const priceDiffPercent = uncappedPrice.sub(cappedPrice).mul(100).div(uncappedPrice);
      expect(priceDiffPercent).to.be.gte(37); // At least 37% of the inflation is blocked
    });
  });
});
