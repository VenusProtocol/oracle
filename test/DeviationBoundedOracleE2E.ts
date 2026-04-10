import { FakeContract, smock } from "@defi-wonderland/smock";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai from "chai";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

import {
  AccessControlManager,
  DeviationBoundedOracle,
  DeviationBoundedOracleCaller,
  DeviationBoundedOracle__factory,
  ResilientOracle,
  VBEP20Harness,
} from "../typechain-types";
import { makeVToken } from "./utils/makeVToken";

const { expect } = chai;
chai.use(smock.matchers);

const EXP_SCALE = parseUnits("1", 18);
const DEFAULT_THRESHOLD = parseUnits("0.2", 18); // 20%
const DEFAULT_RESET_THRESHOLD = parseUnits("0.1", 18); // 10%
const DEFAULT_COOLDOWN = 3600;
const SPOT_PRICE = parseUnits("1", 18);
const MIN_PRICE = parseUnits("0.9", 18);
const MAX_PRICE = parseUnits("1.1", 18);
const KEEPER_DEADBAND = parseUnits("0.05", 18);

describe("DeviationBoundedOracle E2E", () => {
  let admin: SignerWithAddress;
  let resilientOracle: FakeContract<ResilientOracle>;
  let acm: FakeContract<AccessControlManager>;
  let oracle: DeviationBoundedOracle;
  let oracleFactory: DeviationBoundedOracle__factory;
  let caller: DeviationBoundedOracleCaller;
  let vTokenA: VBEP20Harness;
  let vTokenB: VBEP20Harness;
  let assetA: string;
  let assetB: string;
  let nativeMarket: VBEP20Harness;
  let vaiToken: VBEP20Harness;

  before(async () => {
    [admin] = await ethers.getSigners();
    oracleFactory = <DeviationBoundedOracle__factory>await ethers.getContractFactory("DeviationBoundedOracle", admin);
    resilientOracle = await smock.fake<ResilientOracle>("ResilientOracle");
    acm = await smock.fake<AccessControlManager>("AccessControlManager");
    acm.isAllowedToCall.returns(true);

    vTokenA = await makeVToken(
      { name: "vTokenA_E2E", symbol: "vTKA_E" },
      { name: "TokenA_E2E", symbol: "TKA_E", decimals: 18 },
    );
    vTokenB = await makeVToken(
      { name: "vTokenB_E2E", symbol: "vTKB_E" },
      { name: "TokenB_E2E", symbol: "TKB_E", decimals: 18 },
    );
    nativeMarket = await makeVToken(
      { name: "vNative_E2E", symbol: "vNAT_E" },
      { name: "Native_E2E", symbol: "NAT_E", decimals: 18 },
    );
    vaiToken = await makeVToken(
      { name: "vVAI_E2E", symbol: "vVAI_E" },
      { name: "VAI_E2E", symbol: "VAI_E", decimals: 18 },
    );
    assetA = await vTokenA.underlying();
    assetB = await vTokenB.underlying();
  });

  beforeEach(async () => {
    acm.isAllowedToCall.returns(true);
    resilientOracle.getPrice.reset();
    resilientOracle.getPrice.returns(SPOT_PRICE);

    oracle = <DeviationBoundedOracle>await upgrades.deployProxy(oracleFactory, [acm.address], {
      constructorArgs: [resilientOracle.address, nativeMarket.address, await vaiToken.underlying()],
    });

    const CallerFactory = await ethers.getContractFactory("DeviationBoundedOracleCaller", admin);
    caller = <DeviationBoundedOracleCaller>await CallerFactory.deploy(oracle.address);
  });

  // Helper: initialize asset and set a specific min/max window via keeper updates
  const initAssetWithWindow = async (
    asset: string,
    minPrice: BigNumber = MIN_PRICE,
    maxPrice: BigNumber = MAX_PRICE,
    cooldown: number = DEFAULT_COOLDOWN,
    triggerThreshold: BigNumber = DEFAULT_THRESHOLD,
    resetThreshold: BigNumber = DEFAULT_RESET_THRESHOLD,
  ) => {
    await oracle.setTokenConfig(asset, cooldown, triggerThreshold, resetThreshold, true);
    await oracle.updateMinPrice(asset, minPrice);
    await oracle.updateMaxPrice(asset, maxPrice);
  };

  // Helper: trigger protection via pump on an asset with window
  const triggerPump = async (
    asset: string,
    vToken: VBEP20Harness,
    minPrice: BigNumber = MIN_PRICE,
    threshold: BigNumber = DEFAULT_THRESHOLD,
  ): Promise<BigNumber> => {
    const pumpSpot = minPrice.mul(EXP_SCALE.add(threshold)).div(EXP_SCALE).add(1);
    resilientOracle.getPrice.whenCalledWith(asset).returns(pumpSpot);
    await oracle.getBoundedCollateralPrice(vToken.address);
    return pumpSpot;
  };

  // Helper: disable protection by raising reset threshold above current range
  const disableProtection = async (asset: string) => {
    await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
    await ethers.provider.send("evm_mine", []);

    const state = await oracle.assetProtectionConfig(asset);
    const rangeRatio = state.maxPrice.sub(state.minPrice).mul(EXP_SCALE).div(state.minPrice);
    const newReset = rangeRatio.add(1);
    const newTrigger = newReset.add(parseUnits("0.01", 18));

    await oracle.setThresholds(asset, newTrigger, newReset);
    await oracle.disableActiveProtectedPrice(asset);
  };

  // ────────────────────────────────────────────────────────────────────────
  // E2E-1. updateProtectionState → View Price Functions (transient cache)
  // ────────────────────────────────────────────────────────────────────────

  describe("E2E-1: updateProtectionState → view price functions (transient cache)", () => {
    beforeEach(async () => {
      await initAssetWithWindow(assetA);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
    });

    it("1a: cache hit, no protection — view returns cached spot", async () => {
      // updateAndGetBothPrices calls updateProtectionState then views in same tx
      const tx = await caller.callStatic.updateAndGetBothPrices(vTokenA.address);
      expect(tx.collateral).to.equal(SPOT_PRICE);
      expect(tx.debt).to.equal(SPOT_PRICE);
    });

    it("1b: cache hit, protection already active — view returns bounded prices", async () => {
      // Trigger protection in prior tx
      await triggerPump(assetA, vTokenA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Now updateProtectionState → view in same tx
      // Protection already active, _checkAndTriggerProtection returns early.
      // Cached collateral = min(pumpSpot, MIN_PRICE) = MIN_PRICE
      // Cached debt = max(pumpSpot, maxPrice_after_expansion) = pumpSpot (since max was expanded)
      const stateAfter = await oracle.assetProtectionConfig(assetA);
      const result = await caller.callStatic.updateAndGetBothPrices(vTokenA.address);
      expect(result.collateral).to.equal(MIN_PRICE);
      expect(result.debt).to.equal(stateAfter.maxPrice);
    });

    it("1c: cache hit, protection triggered + window expanded in same call", async () => {
      // Spot drops far below MIN_PRICE — triggers protection in same updateProtectionState call
      const crashSpot = parseUnits("0.7", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(crashSpot);

      // After expansion: newMin = crashSpot = 0.7, MAX_PRICE unchanged = 1.1
      // crashSpot < MAX_PRICE*(1-threshold) = 1.1 * 0.8 = 0.88 → 0.7 < 0.88 → triggers
      // collateral = min(crashSpot, newMin) = min(0.7, 0.7) = 0.7
      // debt = max(crashSpot, MAX_PRICE) = max(0.7, 1.1) = 1.1
      const result = await caller.callStatic.updateAndGetBothPrices(vTokenA.address);
      expect(result.collateral).to.equal(crashSpot);
      expect(result.debt).to.equal(MAX_PRICE);

      // Execute to verify state mutation
      await caller.updateAndGetBothPrices(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);
      const stateAfter = await oracle.assetProtectionConfig(assetA);
      expect(stateAfter.minPrice).to.equal(crashSpot);
    });

    it("1d: cache miss, no deviation — view fetches fresh, returns spot", async () => {
      // Call view without prior updateProtectionState → no cache → fresh oracle fetch
      const result = await caller.getViewPricesWithoutUpdate(vTokenA.address);
      expect(result.collateral).to.equal(SPOT_PRICE);
      expect(result.debt).to.equal(SPOT_PRICE);
    });

    it("1e: cache miss, exceeds deviation — simulated trigger returns bounded price", async () => {
      // pumpSpot = MIN_PRICE * (1 + threshold) + 1 = 0.9 * 1.2 + 1wei = 1.08e18 + 1
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);

      // View without update → simulated trigger
      const result = await caller.getViewPricesWithoutUpdate(vTokenA.address);
      // collateral = min(pumpSpot, MIN_PRICE) = MIN_PRICE
      expect(result.collateral).to.equal(MIN_PRICE);
      // pumpSpot ≈ 1.08, MAX_PRICE = 1.1 → max(1.08, 1.1) = 1.1
      expect(result.debt).to.equal(MAX_PRICE);

      // Verify no state mutation
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);
    });

    it("1f: per-asset cache isolation — update A, view B has no cache", async () => {
      const specialSpot = parseUnits("2", 18);
      // Set spot for B before init so setTokenConfig seeds min=max=2.0
      resilientOracle.getPrice.whenCalledWith(assetB).returns(specialSpot);
      await initAssetWithWindow(assetB, parseUnits("1.95", 18), parseUnits("2.05", 18));
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);

      // Update assetA, then view assetB — B should fetch fresh from oracle
      const collateralA = await caller.callStatic.updateAndGetCollateralPrice(vTokenA.address);
      expect(collateralA).to.equal(SPOT_PRICE);

      // View B independently (no cache)
      const resultB = await caller.getViewPricesWithoutUpdate(vTokenB.address);
      expect(resultB.collateral).to.equal(specialSpot);
    });

    it("1g: non-whitelisted — updateProtectionState caches (spot, spot), views return cached spot", async () => {
      await oracle.setAssetBoundedPricingEnabled(assetA, false);
      const specialSpot = parseUnits("1.5", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(specialSpot);

      // updateProtectionState fetches spot and caches (spot, spot); views return from cache
      const result = await caller.callStatic.updateAndGetBothPrices(vTokenA.address);
      expect(result.collateral).to.equal(specialSpot);
      expect(result.debt).to.equal(specialSpot);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // E2E-2. Protection Disabled → Extreme Price Move
  // ────────────────────────────────────────────────────────────────────────

  describe("E2E-2: protection disabled → extreme price move", () => {
    it("2a: non-view re-triggers after disable", async () => {
      await initAssetWithWindow(assetA);

      // Trigger protection
      await triggerPump(assetA, vTokenA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Disable protection (raise reset threshold to allow)
      await disableProtection(assetA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);

      // Extreme price move — another pump
      // After disable, window: min=0.9, max=pumpSpot (~1.08)
      // New pump must exceed upperBound = 0.9 * 1.2 = 1.08
      // Use 1.2 — well above threshold
      const newPumpSpot = parseUnits("1.2", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(newPumpSpot);

      const tx = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(tx).to.emit(oracle, "ProtectionTriggered");
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Returns conservative price: min(1.2, 0.9) = 0.9
      const price = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      expect(price).to.equal(MIN_PRICE);
    });

    it("2b: view simulates trigger after disable", async () => {
      await initAssetWithWindow(assetA);

      // Trigger + disable
      await triggerPump(assetA, vTokenA);
      await disableProtection(assetA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);

      // Extreme price move — 1.2 exceeds upperBound 1.08
      const newPumpSpot = parseUnits("1.2", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(newPumpSpot);

      // View simulates trigger — returns bounded price even though currentlyUsingProtectedPrice is false
      const collateral = await oracle.getBoundedCollateralPriceView(vTokenA.address);
      expect(collateral).to.equal(MIN_PRICE);

      // currentlyUsingProtectedPrice still false (view doesn't mutate)
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);
    });

    it("2c: lastProtectionTriggeredAt is fresh after re-trigger", async () => {
      await initAssetWithWindow(assetA);

      // Trigger
      await triggerPump(assetA, vTokenA);
      const firstState = await oracle.assetProtectionConfig(assetA);
      const firstTriggerTime = firstState.lastProtectionTriggeredAt;

      // Disable
      await disableProtection(assetA);

      // Re-trigger with 1.2
      const newPumpSpot = parseUnits("1.2", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(newPumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      const secondState = await oracle.assetProtectionConfig(assetA);
      expect(secondState.lastProtectionTriggeredAt).to.be.gt(firstTriggerTime);
    });

    it("2d: repeated trigger → disable → trigger cycle", async () => {
      await initAssetWithWindow(assetA);

      for (let cycle = 0; cycle < 3; cycle++) {
        // Use triggerPump which computes minimal pumpSpot from current threshold
        await triggerPump(assetA, vTokenA);
        expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

        // Disable (may raise thresholds to allow exit), then restore to defaults
        await disableProtection(assetA);
        expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);

        // Restore thresholds to defaults using single setThresholds call
        await oracle.setThresholds(assetA, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // E2E-3. Threshold Update Effects on Prices
  // ────────────────────────────────────────────────────────────────────────

  describe("E2E-3: threshold update effects on prices", () => {
    // Spot = 1.15 — triggers at 20% (upperBound = 0.9*1.2 = 1.08) but not at 30% (0.9*1.3 = 1.17)
    const spot = parseUnits("1.15", 18);

    it("3a: lowering threshold triggers previously-safe asset", async () => {
      // Initialize with 30% threshold → upperBound = 0.9 * 1.3 = 1.17
      const highThreshold = parseUnits("0.3", 18);
      const resetThreshold = parseUnits("0.15", 18);
      await oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, highThreshold, resetThreshold, true);
      await oracle.updateMinPrice(assetA, MIN_PRICE);
      await oracle.updateMaxPrice(assetA, MAX_PRICE);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(spot);

      // Spot 1.15 < 1.17 → no trigger at 30%
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);

      // Lower trigger threshold to 20%, keep reset at current value
      const state = await oracle.assetProtectionConfig(assetA);
      await oracle.setThresholds(assetA, DEFAULT_THRESHOLD, state.resetThreshold);

      const tx = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(tx).to.emit(oracle, "ProtectionTriggered");
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);
    });

    it("3b: raising threshold prevents trigger", async () => {
      await initAssetWithWindow(assetA);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(spot);

      // Raise trigger threshold to 30%, keep reset at current value
      const state = await oracle.assetProtectionConfig(assetA);
      await oracle.setThresholds(assetA, parseUnits("0.3", 18), state.resetThreshold);

      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);

      // Verify spot is returned
      const price = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      expect(price).to.equal(spot);
    });

    it("3c: view reflects threshold change immediately", async () => {
      await initAssetWithWindow(assetA);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(spot);

      // At 20% threshold → upperBound = 1.08, spot 1.15 > 1.08 → view returns bounded
      expect(await oracle.getBoundedCollateralPriceView(vTokenA.address)).to.equal(MIN_PRICE);

      // Raise to 30% → upperBound = 1.17, spot 1.15 < 1.17 → view returns spot
      const state = await oracle.assetProtectionConfig(assetA);
      await oracle.setThresholds(assetA, parseUnits("0.3", 18), state.resetThreshold);
      expect(await oracle.getBoundedCollateralPriceView(vTokenA.address)).to.equal(spot);
    });

    it("3d: reset threshold interaction with disableActiveProtectedPrice", async () => {
      await initAssetWithWindow(assetA);

      // Trigger protection
      await triggerPump(assetA, vTokenA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);

      // Current range is wide, reset threshold is 10% — too low to disable
      await expect(oracle.disableActiveProtectedPrice(assetA)).to.be.revertedWithCustomError(
        oracle,
        "PriceRangeNotConverged",
      );

      // Raise reset threshold to allow disable via setThresholds
      const state = await oracle.assetProtectionConfig(assetA);
      const rangeRatio = state.maxPrice.sub(state.minPrice).mul(EXP_SCALE).div(state.minPrice);
      const newReset = rangeRatio.add(parseUnits("0.001", 18));
      const newTrigger = newReset.add(parseUnits("0.01", 18));

      await oracle.setThresholds(assetA, newTrigger, newReset);
      await expect(oracle.disableActiveProtectedPrice(assetA)).to.not.be.reverted;
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // E2E-4. Protection Already Active — No Re-trigger, Window Still Expands
  // ────────────────────────────────────────────────────────────────────────

  describe("E2E-4: no re-trigger when active, window still expands", () => {
    it("4a: continued deviation updates lastProtectionTriggeredAt and re-emits event", async () => {
      await initAssetWithWindow(assetA);

      // Trigger
      const pumpSpot = await triggerPump(assetA, vTokenA);
      const stateAfterTrigger = await oracle.assetProtectionConfig(assetA);
      const triggerTime = stateAfterTrigger.lastProtectionTriggeredAt;

      // Move price even further — deviation still exceeded, so event re-emitted and timestamp updated
      const biggerPump = pumpSpot.add(parseUnits("0.5", 18));
      resilientOracle.getPrice.whenCalledWith(assetA).returns(biggerPump);

      const tx = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(tx).to.emit(oracle, "ProtectionTriggered");

      const stateAfter = await oracle.assetProtectionConfig(assetA);
      expect(stateAfter.lastProtectionTriggeredAt).to.be.gte(triggerTime);
    });

    it("4b: window expands during active protection, deviation re-emits event", async () => {
      await initAssetWithWindow(assetA);
      await triggerPump(assetA, vTokenA);

      // Drop below min → min expands, deviation exceeded → event re-emitted
      const lowSpot = parseUnits("0.8", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(lowSpot);
      const tx1 = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(tx1).to.emit(oracle, "MinPriceUpdated").withArgs(assetA, MIN_PRICE, lowSpot);
      await expect(tx1).to.emit(oracle, "ProtectionTriggered");

      // Rise above current max → max expands, deviation exceeded → event re-emitted
      const stateAfterMin = await oracle.assetProtectionConfig(assetA);
      const highSpot = stateAfterMin.maxPrice.add(parseUnits("0.5", 18));
      resilientOracle.getPrice.whenCalledWith(assetA).returns(highSpot);
      const tx2 = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(tx2).to.emit(oracle, "MaxPriceUpdated");
      await expect(tx2).to.emit(oracle, "ProtectionTriggered");
    });

    it("4c: bounded prices reflect expanded window", async () => {
      await initAssetWithWindow(assetA);
      await triggerPump(assetA, vTokenA);

      // Expand min downward
      const lowSpot = parseUnits("0.8", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(lowSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      // Now collateral should use new min (0.8), not old min (0.9)
      // spot = 0.8, min = 0.8 → collateral = min(0.8, 0.8) = 0.8
      const price = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      expect(price).to.equal(lowSpot);

      // Put spot back between new min and max
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
      const collateralMid = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      // spot=1.0, min=0.8 → collateral = min(1.0, 0.8) = 0.8
      expect(collateralMid).to.equal(lowSpot);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // E2E-5. Keeper During Protection
  // ────────────────────────────────────────────────────────────────────────

  describe("E2E-5: keeper updates during protection", () => {
    it("5a: keeper updates succeed during active protection", async () => {
      await initAssetWithWindow(assetA);
      await triggerPump(assetA, vTokenA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
      await expect(oracle.updateMinPrice(assetA, parseUnits("0.85", 18))).to.not.be.reverted;
      await expect(oracle.updateMaxPrice(assetA, parseUnits("1.15", 18))).to.not.be.reverted;
    });

    it("5b: keeper update succeeds after disable", async () => {
      await initAssetWithWindow(assetA);
      await triggerPump(assetA, vTokenA);
      await disableProtection(assetA);

      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
      await expect(oracle.updateMinPrice(assetA, parseUnits("0.85", 18))).to.not.be.reverted;
      await expect(oracle.updateMaxPrice(assetA, parseUnits("1.15", 18))).to.not.be.reverted;
    });

    it("5c: keeper min update during protection affects bounded prices", async () => {
      await initAssetWithWindow(assetA);
      await triggerPump(assetA, vTokenA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Keeper lowers min during active protection
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
      const newMin = parseUnits("0.85", 18);
      await oracle.updateMinPrice(assetA, newMin);

      // Bounded collateral should now use new min: min(1.0, 0.85) = 0.85
      const collateral = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      expect(collateral).to.equal(newMin);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // E2E-6. Collateral vs Debt Price Divergence Under Protection
  // ────────────────────────────────────────────────────────────────────────

  describe("E2E-6: collateral vs debt price divergence under protection", () => {
    beforeEach(async () => {
      await initAssetWithWindow(assetA);
      // Trigger protection
      await triggerPump(assetA, vTokenA);
    });

    it("6a: spot between min and max — collateral = MIN_PRICE, debt = maxPrice", async () => {
      // Set spot to 1.0 (between 0.9 and expanded max)
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);

      const collateral = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      const debt = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);

      // Protected: collateral = min(1.0, 0.9) = 0.9
      expect(collateral).to.equal(MIN_PRICE);
      // Protected: debt = max(1.0, expandedMax). expandedMax > 1.0 → expandedMax
      const state = await oracle.assetProtectionConfig(assetA);
      expect(debt).to.equal(state.maxPrice);
      expect(collateral).to.not.equal(debt);
    });

    it("6b: spot below min — collateral = spot, debt = maxPrice", async () => {
      const lowSpot = parseUnits("0.8", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(lowSpot);

      // First call expands min to 0.8
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      const collateral = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      const debt = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);

      // min(0.8, 0.8) = 0.8
      expect(collateral).to.equal(lowSpot);
      // max(0.8, expandedMax) = expandedMax
      const state = await oracle.assetProtectionConfig(assetA);
      expect(debt).to.equal(state.maxPrice);
    });

    it("6c: spot above max — collateral = MIN_PRICE, debt = spot", async () => {
      // Spot above the already-expanded max
      const state = await oracle.assetProtectionConfig(assetA);
      const highSpot = state.maxPrice.add(parseUnits("0.5", 18));
      resilientOracle.getPrice.whenCalledWith(assetA).returns(highSpot);

      // First call expands max
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      const collateral = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      const debt = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);

      // collateral = min(highSpot, MIN_PRICE) = MIN_PRICE
      expect(collateral).to.equal(MIN_PRICE);
      // max was expanded to highSpot. debt = max(highSpot, highSpot) = highSpot
      expect(debt).to.equal(highSpot);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // E2E-7. Multiple Assets Independence
  // ────────────────────────────────────────────────────────────────────────

  describe("E2E-7: multiple assets independence", () => {
    it("7a: trigger on one, other unaffected", async () => {
      await initAssetWithWindow(assetA);
      await initAssetWithWindow(assetB);

      // Trigger protection on A with pump spot > upperBound (0.9 * 1.2 = 1.08)
      const pumpSpot = parseUnits("1.2", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      resilientOracle.getPrice.whenCalledWith(assetB).returns(SPOT_PRICE);

      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);
      expect(await oracle.currentlyUsingProtectedPrice(assetB)).to.equal(false);

      // B returns spot unprotected
      const priceB = await oracle.callStatic.getBoundedCollateralPrice(vTokenB.address);
      expect(priceB).to.equal(SPOT_PRICE);

      // Keeper can still update B bounds
      await expect(oracle.updateMinPrice(assetB, parseUnits("0.85", 18))).to.not.be.reverted;
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // E2E-8. setAssetBoundedPricingEnabled Round-Trip
  // ────────────────────────────────────────────────────────────────────────

  describe("E2E-8: setAssetBoundedPricingEnabled round-trip", () => {
    it("8a: disable returns spot, re-enable resets window to current spot", async () => {
      await initAssetWithWindow(assetA);

      // Set pump spot that would trigger: 1.2 > upperBound 1.08
      const pumpSpot = parseUnits("1.2", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);

      // Disable bounded pricing → returns spot (not bounded)
      await oracle.setAssetBoundedPricingEnabled(assetA, false);
      const priceDisabled = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      expect(priceDisabled).to.equal(pumpSpot);

      // Re-enable → window resets to current spot (min=max=pumpSpot)
      await oracle.setAssetBoundedPricingEnabled(assetA, true);
      // Fresh window at pumpSpot, no deviation → returns spot
      const priceReEnabled = await oracle.getBoundedCollateralPriceView(vTokenA.address);
      expect(priceReEnabled).to.equal(pumpSpot);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // E2E-10. Multiple Sequential Calls in Same Transaction
  // ────────────────────────────────────────────────────────────────────────

  describe("E2E-10: multiple sequential calls in same transaction", () => {
    it("10a: two consecutive non-view calls — second reflects updated window", async () => {
      await initAssetWithWindow(assetA);

      // Pump spot > upperBound (1.08): use 1.2
      const pumpSpot = parseUnits("1.2", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);

      // Both calls in same tx via caller
      const result = await caller.callStatic.twoConsecutiveNonViewCollateral(vTokenA.address);

      // First call: triggers protection, collateral = min(1.2, 0.9) = 0.9
      expect(result.first).to.equal(MIN_PRICE);
      // Second call: protection already active, no re-trigger. Same spot, same window.
      // collateral = min(1.2, 0.9) = 0.9
      expect(result.second).to.equal(MIN_PRICE);
    });

    it("10b: updateProtectionState then non-view — non-view reads from cache", async () => {
      await initAssetWithWindow(assetA);

      // Pump spot > upperBound (1.08): use 1.2
      const pumpSpot = parseUnits("1.2", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);

      // updateProtectionState caches, then non-view reads from cache
      const result = await caller.callStatic.updateThenNonViewCollateral(vTokenA.address);
      // collateral = min(1.2, 0.9) = 0.9
      expect(result).to.equal(MIN_PRICE);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // E2E-11. Atomic Window Expansion + Protection Trigger
  // ────────────────────────────────────────────────────────────────────────

  describe("E2E-11: atomic window expansion + protection trigger", () => {
    it("11a: spot jumps far above maxPrice — only pump triggers, not crash", async () => {
      await initAssetWithWindow(assetA);

      // Spot jumps to 2.0 — far above MAX_PRICE (1.1)
      const bigPump = parseUnits("2", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(bigPump);

      const tx = await oracle.getBoundedCollateralPrice(vTokenA.address);

      // Window expansion: max → 2.0 (spot > old max 1.1)
      await expect(tx).to.emit(oracle, "MaxPriceUpdated").withArgs(assetA, MAX_PRICE, bigPump);

      // Protection triggered (pump: spot 2.0 > MIN_PRICE * 1.2 = 1.08)
      await expect(tx).to.emit(oracle, "ProtectionTriggered");
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // E2E-12. Boundary Precision Tests
  // ────────────────────────────────────────────────────────────────────────

  describe("E2E-12: boundary precision tests", () => {
    it("12a: deviation threshold strict inequality — exact boundary does NOT trigger", async () => {
      await initAssetWithWindow(assetA);

      // upperBound = MIN_PRICE * (1 + threshold) = 0.9 * 1.2 = 1.08e18
      const upperBound = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(upperBound);

      // Exact boundary → should NOT trigger (uses > not >=)
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);

      // boundary + 1 → triggers
      resilientOracle.getPrice.whenCalledWith(assetA).returns(upperBound.add(1));
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);
    });

    it("12b: reset threshold strict inequality — exact value reverts, minus 1 succeeds", async () => {
      await initAssetWithWindow(assetA);

      // Trigger
      await triggerPump(assetA, vTokenA);

      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);

      const state = await oracle.assetProtectionConfig(assetA);
      const rangeRatio = state.maxPrice.sub(state.minPrice).mul(EXP_SCALE).div(state.minPrice);

      // Set resetThreshold = rangeRatio via setThresholds → disableActiveProtectedPrice reverts (>=)
      const triggerThreshold = rangeRatio.add(parseUnits("0.01", 18));
      await oracle.setThresholds(assetA, triggerThreshold, rangeRatio);
      await expect(oracle.disableActiveProtectedPrice(assetA)).to.be.revertedWithCustomError(
        oracle,
        "PriceRangeNotConverged",
      );

      // Set resetThreshold = rangeRatio + 1 → succeeds
      if (rangeRatio.add(1).lt(triggerThreshold)) {
        await oracle.setThresholds(assetA, triggerThreshold, rangeRatio.add(1));
        await expect(oracle.disableActiveProtectedPrice(assetA)).to.not.be.reverted;
      }
    });

    it("12c: deadband strict inequality — exact value returns false, +1 returns true", async () => {
      await initAssetWithWindow(assetA);

      // proposedMin such that drift = exactly KEEPER_DEADBAND (5%)
      // drift = |current - proposed| * 1e18 / current = KEEPER_DEADBAND
      // proposed = current * (1e18 - KEEPER_DEADBAND) / 1e18 = 0.9 * 0.95 = 0.855
      const proposedMinExact = MIN_PRICE.mul(EXP_SCALE.sub(KEEPER_DEADBAND)).div(EXP_SCALE);

      const [needsMinExact] = await oracle.checkAndGetWindowDrift([assetA], [proposedMinExact], [MAX_PRICE]);
      expect(needsMinExact[0]).to.equal(false);

      // proposed - 1 → drift slightly above deadband
      const proposedMinPlusOne = proposedMinExact.sub(1);
      const [needsMinPlus] = await oracle.checkAndGetWindowDrift([assetA], [proposedMinPlusOne], [MAX_PRICE]);
      expect(needsMinPlus[0]).to.equal(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // E2E-13. Transient Cache Call-Count Verification
  // ────────────────────────────────────────────────────────────────────────

  describe("E2E-13: transient cache call-count verification", () => {
    beforeEach(async () => {
      await initAssetWithWindow(assetA);
      resilientOracle.getPrice.reset();
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
    });

    it("13a: cache hit — update + both views makes only 1 oracle call", async () => {
      await caller.updateAndGetBothPrices(vTokenA.address);

      // updateProtectionState fetches spot once; both views read from transient cache
      expect(resilientOracle.getPrice).to.have.callCount(1);
    });

    it("13b: cache miss — views without update make 2 oracle calls", async () => {
      // Non-view wrapper so smock records the calls
      await caller.getViewPricesWithoutUpdateNonView(vTokenA.address);

      // No prior updateProtectionState → cache empty → each view fetches independently
      expect(resilientOracle.getPrice).to.have.callCount(2);
    });

    it("13c: non-view after update uses cache — update + non-view makes 1 oracle call", async () => {
      await caller.updateThenNonViewCollateral(vTokenA.address);

      // updateProtectionState fetches once and caches; getBoundedCollateralPrice reads from cache
      expect(resilientOracle.getPrice).to.have.callCount(1);
    });

    it("13d: two consecutive non-view calls — 1 oracle call (second reads cache)", async () => {
      await caller.twoConsecutiveNonViewCollateral(vTokenA.address);

      // First getBoundedCollateralPrice fetches and caches; second reads from cache
      expect(resilientOracle.getPrice).to.have.callCount(1);
    });

    it("13e: per-asset cache isolation — update A, view B still calls oracle", async () => {
      const spotB = parseUnits("2", 18);
      // Set spot for B before init so setTokenConfig seeds and keeper updates succeed
      resilientOracle.getPrice.whenCalledWith(assetB).returns(SPOT_PRICE);
      await initAssetWithWindow(assetB);

      resilientOracle.getPrice.reset();
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
      resilientOracle.getPrice.whenCalledWith(assetB).returns(spotB);

      // updateProtectionState(A) caches A's prices; view(B) has no cache → fetches fresh
      await caller.updateAViewB(vTokenA.address, vTokenB.address);

      // 1 call for A (update), 1 call for B (cache miss view) = 2 total
      expect(resilientOracle.getPrice).to.have.callCount(2);
    });

    it("13f: cache hit under active protection — still only 1 oracle call", async () => {
      // Trigger protection in prior tx
      await triggerPump(assetA, vTokenA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Reset call tracking after setup
      resilientOracle.getPrice.reset();
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);

      await caller.updateAndGetBothPrices(vTokenA.address);

      // Even under active protection, updateProtectionState caches both prices → views use cache
      expect(resilientOracle.getPrice).to.have.callCount(1);
    });

    it("13g: non-whitelisted — update fetches+caches, views read cache = 1 oracle call", async () => {
      await oracle.setAssetBoundedPricingEnabled(assetA, false);

      resilientOracle.getPrice.reset();
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);

      await caller.updateAndGetBothPrices(vTokenA.address);

      // updateProtectionState fetches spot and caches (spot, spot). Views read from cache.
      expect(resilientOracle.getPrice).to.have.callCount(1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // E2E-14. getBoundedPrices Dual-Price API
  // ────────────────────────────────────────────────────────────────────────

  describe("E2E-14: getBoundedPrices dual-price API", () => {
    it("14a: updateProtectionState → getBoundedPricesView returns both cached prices", async () => {
      await initAssetWithWindow(assetA);

      // Trigger protection
      await triggerPump(assetA, vTokenA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Set a spot between min and max
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);

      // updateProtectionState caches, then getBoundedPricesView reads cache
      const result = await caller.callStatic.updateAndGetBothPrices(vTokenA.address);
      const state = await oracle.assetProtectionConfig(assetA);

      // collateral = min(spot, minPrice) = min(1.0, 0.9) = 0.9
      expect(result.collateral).to.equal(MIN_PRICE);
      // debt = max(spot, maxPrice) = maxPrice (expanded)
      expect(result.debt).to.equal(state.maxPrice);
    });

    it("14b: getBoundedPrices (non-view) returns same as individual functions", async () => {
      await initAssetWithWindow(assetA);

      // Trigger protection
      await triggerPump(assetA, vTokenA);

      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);

      // Get prices via individual functions
      const collateral = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      const debt = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);

      // Get prices via dual API
      const result = await oracle.callStatic.getBoundedPrices(vTokenA.address);

      expect(result.collateralPrice).to.equal(collateral);
      expect(result.debtPrice).to.equal(debt);
    });

    it("14c: getBoundedPricesView matches individual view functions", async () => {
      await initAssetWithWindow(assetA);

      // Trigger protection so prices diverge
      await triggerPump(assetA, vTokenA);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);

      // Get prices via individual view functions
      const collateral = await oracle.getBoundedCollateralPriceView(vTokenA.address);
      const debt = await oracle.getBoundedDebtPriceView(vTokenA.address);

      // Get prices via dual view API
      const result = await oracle.getBoundedPricesView(vTokenA.address);

      expect(result.collateralPrice).to.equal(collateral);
      expect(result.debtPrice).to.equal(debt);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // E2E-15. Keeper Updates During Active Protection
  // ────────────────────────────────────────────────────────────────────────

  describe("E2E-15: keeper updates during active protection", () => {
    it("15a: trigger → keeper updates min → bounded collateral reflects new min", async () => {
      await initAssetWithWindow(assetA);
      await triggerPump(assetA, vTokenA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Spot is between min and max
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);

      // Verify collateral = MIN_PRICE before keeper update
      const collateralBefore = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      expect(collateralBefore).to.equal(MIN_PRICE);

      // Keeper lowers min
      const newMin = parseUnits("0.85", 18);
      await oracle.updateMinPrice(assetA, newMin);

      // Bounded collateral now uses new min: min(1.0, 0.85) = 0.85
      const collateralAfter = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      expect(collateralAfter).to.equal(newMin);
    });

    it("15b: trigger → keeper updates max → bounded debt reflects new max", async () => {
      await initAssetWithWindow(assetA);
      await triggerPump(assetA, vTokenA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Record original max
      const stateBefore = await oracle.assetProtectionConfig(assetA);
      const originalMax = stateBefore.maxPrice;

      // Spot is between min and max
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);

      // Verify debt = originalMax before keeper update
      const debtBefore = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);
      expect(debtBefore).to.equal(originalMax);

      // Keeper raises max
      const newMax = originalMax.add(parseUnits("0.1", 18));
      await oracle.updateMaxPrice(assetA, newMax);

      // Bounded debt now uses new max: max(1.0, newMax) = newMax
      const debtAfter = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);
      expect(debtAfter).to.equal(newMax);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // E2E-16. Volatile Price Extends Protection Period
  // ────────────────────────────────────────────────────────────────────────

  describe("E2E-16: volatile price extends protection period", () => {
    it("16a: continued deviation extends cooldown, blocks early disable", async () => {
      await initAssetWithWindow(assetA);

      // Trigger protection
      const pumpSpot = await triggerPump(assetA, vTokenA);
      const firstTriggerTime = (await oracle.assetProtectionConfig(assetA)).lastProtectionTriggeredAt;

      // Advance half cooldown
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN / 2]);
      await ethers.provider.send("evm_mine", []);

      // Another deviating price → updates lastProtectionTriggeredAt
      const biggerPump = pumpSpot.add(parseUnits("0.2", 18));
      resilientOracle.getPrice.whenCalledWith(assetA).returns(biggerPump);
      const tx = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(tx).to.emit(oracle, "ProtectionTriggered");

      const secondTriggerTime = (await oracle.assetProtectionConfig(assetA)).lastProtectionTriggeredAt;
      expect(secondTriggerTime).to.be.gt(firstTriggerTime);

      // Advance half cooldown again — total = cooldown from initial but only half from latest
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN / 2]);
      await ethers.provider.send("evm_mine", []);

      // Raise reset threshold so range check passes, but cooldown should block
      const state = await oracle.assetProtectionConfig(assetA);
      const range = state.maxPrice.sub(state.minPrice).mul(EXP_SCALE).div(state.minPrice);
      const newReset = range.add(parseUnits("0.001", 18));
      const trigger = state.triggerThreshold;
      if (newReset.gte(trigger)) {
        await oracle.setThresholds(assetA, newReset.add(parseUnits("0.01", 18)), newReset);
      } else {
        await oracle.setThresholds(assetA, trigger, newReset);
      }

      // Disable should revert — cooldown restarted from second trigger
      await expect(oracle.disableActiveProtectedPrice(assetA)).to.be.revertedWithCustomError(
        oracle,
        "CooldownNotElapsed",
      );

      // Advance remaining half cooldown
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN / 2 + 1]);
      await ethers.provider.send("evm_mine", []);

      // Now disable succeeds
      await expect(oracle.disableActiveProtectedPrice(assetA)).to.not.be.reverted;
    });

    it("16b: price normalizes — no event, timestamp unchanged, protection still active", async () => {
      await initAssetWithWindow(assetA);

      await triggerPump(assetA, vTokenA);
      const triggerTime = (await oracle.assetProtectionConfig(assetA)).lastProtectionTriggeredAt;

      // Price returns within threshold
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
      const tx = await oracle.getBoundedCollateralPrice(vTokenA.address);

      await expect(tx).to.not.emit(oracle, "ProtectionTriggered");
      expect((await oracle.assetProtectionConfig(assetA)).lastProtectionTriggeredAt).to.equal(triggerTime);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Bounded pricing still applies
      const collateral = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      expect(collateral).to.equal(MIN_PRICE);
    });

    it("16c: full volatile cycle — repeated spikes extend protection, normalization in between, final disable", async () => {
      await initAssetWithWindow(assetA);

      // ── Cycle 1: initial trigger ──
      const pumpSpot1 = await triggerPump(assetA, vTokenA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);
      const trigger1 = (await oracle.assetProtectionConfig(assetA)).lastProtectionTriggeredAt;

      // Price normalizes mid-cycle — protection still active, timestamp unchanged
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN / 4]);
      await ethers.provider.send("evm_mine", []);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
      const txNorm1 = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(txNorm1).to.not.emit(oracle, "ProtectionTriggered");
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Bounded pricing still applies despite normal spot
      expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(MIN_PRICE);

      // ── Cycle 2: second spike extends cooldown (keep within window to avoid exceeding MAX_THRESHOLD) ──
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN / 4]);
      await ethers.provider.send("evm_mine", []);
      const pumpSpot2 = pumpSpot1.add(parseUnits("0.05", 18));
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot2);
      const txSpike2 = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(txSpike2).to.emit(oracle, "ProtectionTriggered");
      const trigger2 = (await oracle.assetProtectionConfig(assetA)).lastProtectionTriggeredAt;
      expect(trigger2).to.be.gt(trigger1);

      // Try disable after original cooldown elapsed but not after second trigger
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN / 2 + 1]);
      await ethers.provider.send("evm_mine", []);

      // Raise reset threshold so range check passes
      const stateM = await oracle.assetProtectionConfig(assetA);
      const rangeM = stateM.maxPrice.sub(stateM.minPrice).mul(EXP_SCALE).div(stateM.minPrice);
      const newResetM = rangeM.add(parseUnits("0.001", 18));
      const triggerM = stateM.triggerThreshold;
      if (newResetM.gte(triggerM)) {
        await oracle.setThresholds(assetA, newResetM.add(parseUnits("0.01", 18)), newResetM);
      } else {
        await oracle.setThresholds(assetA, triggerM, newResetM);
      }

      // Disable fails — cooldown restarted from second spike
      await expect(oracle.disableActiveProtectedPrice(assetA)).to.be.revertedWithCustomError(
        oracle,
        "CooldownNotElapsed",
      );

      // Price normalizes again — still protected
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
      const txNorm2 = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(txNorm2).to.not.emit(oracle, "ProtectionTriggered");
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);
      expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(MIN_PRICE);

      // ── Final: wait full cooldown from last spike, disable succeeds ──
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN]);
      await ethers.provider.send("evm_mine", []);

      await oracle.disableActiveProtectedPrice(assetA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);
      expect((await oracle.assetProtectionConfig(assetA)).lastProtectionTriggeredAt).to.equal(0);

      // Spot prices returned after disable
      const collateral = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      const debt = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);
      expect(collateral).to.equal(SPOT_PRICE);
      expect(debt).to.equal(SPOT_PRICE);
    });
  });
});
