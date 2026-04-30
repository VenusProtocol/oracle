import { FakeContract, smock } from "@defi-wonderland/smock";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai from "chai";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

import {
  AccessControlManager,
  DeviationBoundedOracle,
  DeviationBoundedOracle__factory,
  ResilientOracle,
  VBEP20Harness,
} from "../typechain-types";
import { addr0000 } from "./utils/data";
import { makeVToken } from "./utils/makeVToken";

const { expect } = chai;
chai.use(smock.matchers);

const EXP_SCALE = parseUnits("1", 18);
const MIN_THRESHOLD = parseUnits("0.05", 18); // 5%
const MAX_THRESHOLD = parseUnits("0.5", 18); // 50%
const KEEPER_DEADBAND = parseUnits("0.05", 18); // 5%
const DEFAULT_THRESHOLD = parseUnits("0.2", 18); // 20%
const DEFAULT_RESET_THRESHOLD = parseUnits("0.1", 18); // 10%
const DEFAULT_COOLDOWN = 3600; // 1 hour
const SPOT_PRICE = parseUnits("1", 18); // 1e18
const MIN_PRICE = parseUnits("0.9", 18);
const MAX_PRICE = parseUnits("1.1", 18);
const NATIVE_TOKEN_ADDR = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";

describe("DeviationBoundedOracle", () => {
  let admin: SignerWithAddress;
  let someone: SignerWithAddress;
  let resilientOracle: FakeContract<ResilientOracle>;
  let acm: FakeContract<AccessControlManager>;
  let oracle: DeviationBoundedOracle;
  let oracleFactory: DeviationBoundedOracle__factory;
  let vTokenA: VBEP20Harness;
  let vTokenB: VBEP20Harness;
  let assetA: string;
  let assetB: string;
  let nativeMarket: VBEP20Harness;
  let vaiToken: VBEP20Harness;

  // Basic init: min=max=spot (SPOT_PRICE = 1e18)
  const initAsset = async (
    asset: string,
    cooldown: number = DEFAULT_COOLDOWN,
    triggerThreshold: BigNumber = DEFAULT_THRESHOLD,
    resetThreshold: BigNumber = DEFAULT_RESET_THRESHOLD,
  ) => {
    await oracle.setTokenConfig(asset, cooldown, triggerThreshold, resetThreshold, true, true);
  };

  // Init + widen window via keeper updates (for price-bounding tests that need min=0.9, max=1.1)
  const initAssetWithWindow = async (
    asset: string,
    minPrice: BigNumber = MIN_PRICE,
    maxPrice: BigNumber = MAX_PRICE,
    cooldown: number = DEFAULT_COOLDOWN,
    triggerThreshold: BigNumber = DEFAULT_THRESHOLD,
    resetThreshold: BigNumber = DEFAULT_RESET_THRESHOLD,
  ) => {
    await oracle.setTokenConfig(asset, cooldown, triggerThreshold, resetThreshold, true, true);
    await oracle.updateMinPrice(asset, minPrice);
    await oracle.updateMaxPrice(asset, maxPrice);
  };

  before(async () => {
    [admin, someone] = await ethers.getSigners();
    oracleFactory = <DeviationBoundedOracle__factory>await ethers.getContractFactory("DeviationBoundedOracle", admin);
    resilientOracle = await smock.fake<ResilientOracle>("ResilientOracle");
    acm = await smock.fake<AccessControlManager>("AccessControlManager");
    acm.isAllowedToCall.returns(true);

    vTokenA = await makeVToken({ name: "vTokenA", symbol: "vTKA" }, { name: "TokenA", symbol: "TKA", decimals: 18 });
    vTokenB = await makeVToken({ name: "vTokenB", symbol: "vTKB" }, { name: "TokenB", symbol: "TKB", decimals: 18 });
    nativeMarket = await makeVToken(
      { name: "vNative", symbol: "vNAT" },
      { name: "Native", symbol: "NAT", decimals: 18 },
    );
    vaiToken = await makeVToken({ name: "vVAI", symbol: "vVAI" }, { name: "VAI", symbol: "VAI", decimals: 18 });
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
  });

  // ────────────────────────────────────────────────────────────────────────
  // 1. Constructor
  // ────────────────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("sets immutables correctly", async () => {
      expect(await oracle.RESILIENT_ORACLE()).to.equal(resilientOracle.address);
      expect(await oracle.nativeMarket()).to.equal(nativeMarket.address);
      expect(await oracle.vai()).to.equal(await vaiToken.underlying());
    });

    it("reverts when _resilientOracle is zero address", async () => {
      await expect(
        upgrades.deployProxy(oracleFactory, [acm.address], {
          constructorArgs: [addr0000, nativeMarket.address, await vaiToken.underlying()],
        }),
      ).to.be.revertedWithCustomError(oracle, "ZeroAddressNotAllowed");
    });

    it("reverts when nativeMarketAddress is zero address", async () => {
      await expect(
        upgrades.deployProxy(oracleFactory, [acm.address], {
          constructorArgs: [resilientOracle.address, addr0000, await vaiToken.underlying()],
        }),
      ).to.be.revertedWithCustomError(oracle, "ZeroAddressNotAllowed");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 2. Initialize
  // ────────────────────────────────────────────────────────────────────────

  describe("initialize", () => {
    it("sets access control manager", async () => {
      expect(await oracle.accessControlManager()).to.equal(acm.address);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 3. setTokenConfig
  // ────────────────────────────────────────────────────────────────────────

  describe("setTokenConfig", () => {
    describe("happy path", () => {
      it("sets all struct fields, emits events, updates asset lists", async () => {
        const tx = await oracle.setTokenConfig(
          assetA,
          DEFAULT_COOLDOWN,
          DEFAULT_THRESHOLD,
          DEFAULT_RESET_THRESHOLD,
          true,
          true,
        );

        // Verify struct fields via public getter
        const state = await oracle.assetProtectionConfig(assetA);
        expect(state.minPrice).to.equal(SPOT_PRICE);
        expect(state.maxPrice).to.equal(SPOT_PRICE);
        expect(state.currentlyUsingProtectedPrice).to.equal(false);
        expect(state.isBoundedPricingEnabled).to.equal(true);
        expect(state.lastProtectionTriggeredAt).to.equal(0);
        expect(state.cooldownPeriod).to.equal(DEFAULT_COOLDOWN);
        expect(state.asset).to.equal(assetA);
        expect(state.triggerThreshold).to.equal(DEFAULT_THRESHOLD);
        expect(state.resetThreshold).to.equal(DEFAULT_RESET_THRESHOLD);
        expect(state.cachingEnabled).to.equal(true);

        // Verify events
        await expect(tx)
          .to.emit(oracle, "ProtectionInitialized")
          .withArgs(assetA, SPOT_PRICE, SPOT_PRICE, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD);
        await expect(tx).to.emit(oracle, "BoundedPricingWhitelistUpdated").withArgs(assetA, true);

        // Verify in getInitializedAssets
        const initialized = await oracle.getInitializedAssets();
        expect(initialized).to.include(assetA);

        // Verify in getAllBoundedPricingEnabledAssets
        const whitelisted = await oracle.getAllBoundedPricingEnabledAssets();
        expect(whitelisted).to.include(assetA);
      });

      it("initializes with bounded pricing disabled when enableBoundedPricing is false", async () => {
        const tx = await oracle.setTokenConfig(
          assetA,
          DEFAULT_COOLDOWN,
          DEFAULT_THRESHOLD,
          DEFAULT_RESET_THRESHOLD,
          false,
          true,
        );

        const state = await oracle.assetProtectionConfig(assetA);
        expect(state.isBoundedPricingEnabled).to.equal(false);
        await expect(tx).to.emit(oracle, "BoundedPricingWhitelistUpdated").withArgs(assetA, false);

        // Price functions return spot (not bounded) even with deviation
        const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
        resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
        const price = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
        expect(price).to.equal(pumpSpot);
      });
    });

    describe("revert branches", () => {
      it("reverts when caller is unauthorized", async () => {
        acm.isAllowedToCall.returns(false);
        await expect(
          oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD, true, true),
        ).to.be.revertedWithCustomError(oracle, "Unauthorized");
      });

      it("reverts when asset is zero address", async () => {
        await expect(
          oracle.setTokenConfig(addr0000, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD, true, true),
        ).to.be.revertedWithCustomError(oracle, "ZeroAddressNotAllowed");
      });

      it("reverts when already initialized", async () => {
        await initAsset(assetA);
        await expect(
          oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD, true, true),
        ).to.be.revertedWithCustomError(oracle, "MarketAlreadyInitialized");
      });

      it("reverts when threshold < MIN_THRESHOLD", async () => {
        await expect(
          oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, MIN_THRESHOLD.sub(1), DEFAULT_RESET_THRESHOLD, true, true),
        ).to.be.revertedWithCustomError(oracle, "ThresholdBelowMinimum");
      });

      it("reverts when threshold > MAX_THRESHOLD", async () => {
        await expect(
          oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, MAX_THRESHOLD.add(1), DEFAULT_RESET_THRESHOLD, true, true),
        ).to.be.revertedWithCustomError(oracle, "ThresholdAboveMaximum");
      });

      it("reverts when resetThreshold >= triggerThreshold", async () => {
        await expect(
          oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, DEFAULT_THRESHOLD, true, true),
        ).to.be.revertedWithCustomError(oracle, "InvalidResetThreshold");
      });

      it("reverts when asset is VAI", async () => {
        const vaiAddr = await vaiToken.underlying();
        await expect(
          oracle.setTokenConfig(vaiAddr, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD, true, true),
        ).to.be.revertedWithCustomError(oracle, "VAINotAllowed");
      });

      it("reverts when cooldownPeriod is zero", async () => {
        await expect(
          oracle.setTokenConfig(assetA, 0, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD, true, true),
        ).to.be.revertedWithCustomError(oracle, "ZeroValueNotAllowed");
      });

      it("reverts when triggerThreshold is zero", async () => {
        await expect(
          oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, 0, DEFAULT_RESET_THRESHOLD, true, true),
        ).to.be.revertedWithCustomError(oracle, "ZeroValueNotAllowed");
      });

      it("reverts when resetThreshold is zero", async () => {
        await expect(
          oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, 0, true, true),
        ).to.be.revertedWithCustomError(oracle, "ZeroValueNotAllowed");
      });

      it("reverts when re-initializing after de-whitelist", async () => {
        await initAsset(assetA);
        await oracle.setAssetBoundedPricingEnabled(assetA, false);
        await expect(
          oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD, true, true),
        ).to.be.revertedWithCustomError(oracle, "MarketAlreadyInitialized");
      });

      it("reverts with PriceExceedsUint128 when oracle returns > uint128 max", async () => {
        const overflowPrice = BigNumber.from(2).pow(128);
        resilientOracle.getPrice.whenCalledWith(assetA).returns(overflowPrice);
        await expect(
          oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD, true, true),
        ).to.be.revertedWithCustomError(oracle, "PriceExceedsUint128");
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 3b. setTokenConfigs (batch)
  // ────────────────────────────────────────────────────────────────────────

  describe("setTokenConfigs (batch)", () => {
    it("batch-initializes multiple assets, verifies structs and events", async () => {
      const tx = await oracle.setTokenConfigs(
        [assetA, assetB],
        [DEFAULT_COOLDOWN, DEFAULT_COOLDOWN],
        [DEFAULT_THRESHOLD, DEFAULT_THRESHOLD],
        [DEFAULT_RESET_THRESHOLD, DEFAULT_RESET_THRESHOLD],
        [true, true],
        [true, true],
      );

      // Verify both assets initialized
      const stateA = await oracle.assetProtectionConfig(assetA);
      expect(stateA.asset).to.equal(assetA);
      expect(stateA.isBoundedPricingEnabled).to.equal(true);
      expect(stateA.minPrice).to.equal(SPOT_PRICE);

      const stateB = await oracle.assetProtectionConfig(assetB);
      expect(stateB.asset).to.equal(assetB);
      expect(stateB.isBoundedPricingEnabled).to.equal(true);

      // Verify events for both
      await expect(tx)
        .to.emit(oracle, "ProtectionInitialized")
        .withArgs(assetA, SPOT_PRICE, SPOT_PRICE, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD);
      await expect(tx)
        .to.emit(oracle, "ProtectionInitialized")
        .withArgs(assetB, SPOT_PRICE, SPOT_PRICE, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD);
      await expect(tx).to.emit(oracle, "BoundedPricingWhitelistUpdated").withArgs(assetA, true);
      await expect(tx).to.emit(oracle, "BoundedPricingWhitelistUpdated").withArgs(assetB, true);

      const initialized = await oracle.getInitializedAssets();
      expect(initialized.length).to.equal(2);
    });

    it("batch with mixed enableBoundedPricing values", async () => {
      await oracle.setTokenConfigs(
        [assetA, assetB],
        [DEFAULT_COOLDOWN, DEFAULT_COOLDOWN],
        [DEFAULT_THRESHOLD, DEFAULT_THRESHOLD],
        [DEFAULT_RESET_THRESHOLD, DEFAULT_RESET_THRESHOLD],
        [true, false],
        [true, true],
      );

      expect(await oracle.isBoundedPricingEnabled(assetA)).to.equal(true);
      expect(await oracle.isBoundedPricingEnabled(assetB)).to.equal(false);
    });

    it("reverts when caller is unauthorized", async () => {
      acm.isAllowedToCall.returns(false);
      await expect(
        oracle.setTokenConfigs(
          [assetA],
          [DEFAULT_COOLDOWN],
          [DEFAULT_THRESHOLD],
          [DEFAULT_RESET_THRESHOLD],
          [true],
          [true],
        ),
      ).to.be.revertedWithCustomError(oracle, "Unauthorized");
    });

    it("reverts when array lengths mismatch", async () => {
      await expect(
        oracle.setTokenConfigs(
          [assetA, assetB],
          [DEFAULT_COOLDOWN],
          [DEFAULT_THRESHOLD],
          [DEFAULT_RESET_THRESHOLD],
          [true],
          [true],
        ),
      ).to.be.revertedWithCustomError(oracle, "InvalidArrayLength");
    });

    it("reverts when one asset in batch is invalid (entire tx reverts)", async () => {
      await expect(
        oracle.setTokenConfigs(
          [assetA, addr0000],
          [DEFAULT_COOLDOWN, DEFAULT_COOLDOWN],
          [DEFAULT_THRESHOLD, DEFAULT_THRESHOLD],
          [DEFAULT_RESET_THRESHOLD, DEFAULT_RESET_THRESHOLD],
          [true, true],
          [true, true],
        ),
      ).to.be.revertedWithCustomError(oracle, "ZeroAddressNotAllowed");
    });

    it("reverts when one asset is already initialized", async () => {
      await initAsset(assetA);
      await expect(
        oracle.setTokenConfigs(
          [assetA, assetB],
          [DEFAULT_COOLDOWN, DEFAULT_COOLDOWN],
          [DEFAULT_THRESHOLD, DEFAULT_THRESHOLD],
          [DEFAULT_RESET_THRESHOLD, DEFAULT_RESET_THRESHOLD],
          [true, true],
          [true, true],
        ),
      ).to.be.revertedWithCustomError(oracle, "MarketAlreadyInitialized");
    });

    it("succeeds with empty arrays (no-op)", async () => {
      await expect(oracle.setTokenConfigs([], [], [], [], [], [])).to.be.revertedWithCustomError(
        oracle,
        "InvalidArrayLength",
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 4. setCooldownPeriod
  // ────────────────────────────────────────────────────────────────────────

  describe("setCooldownPeriod", () => {
    beforeEach(async () => {
      await initAsset(assetA);
    });

    it("updates cooldownPeriod and emits event", async () => {
      const newCooldown = 7200;
      const tx = await oracle.setCooldownPeriod(assetA, newCooldown);
      await expect(tx).to.emit(oracle, "CooldownPeriodSet").withArgs(assetA, DEFAULT_COOLDOWN, newCooldown);
      const state = await oracle.assetProtectionConfig(assetA);
      expect(state.cooldownPeriod).to.equal(newCooldown);
    });

    it("reverts when caller is unauthorized", async () => {
      acm.isAllowedToCall.returns(false);
      await expect(oracle.setCooldownPeriod(assetA, 7200)).to.be.revertedWithCustomError(oracle, "Unauthorized");
    });

    it("reverts when asset is zero address", async () => {
      await expect(oracle.setCooldownPeriod(addr0000, 7200)).to.be.revertedWithCustomError(
        oracle,
        "ZeroAddressNotAllowed",
      );
    });

    it("reverts when not initialized", async () => {
      await expect(oracle.setCooldownPeriod(assetB, 7200)).to.be.revertedWithCustomError(
        oracle,
        "MarketNotInitialized",
      );
    });

    it("reverts when new cooldown is zero", async () => {
      await expect(oracle.setCooldownPeriod(assetA, 0)).to.be.revertedWithCustomError(oracle, "ZeroValueNotAllowed");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 5. setThresholds
  // ────────────────────────────────────────────────────────────────────────

  describe("setThresholds", () => {
    beforeEach(async () => {
      await initAsset(assetA);
    });

    it("updates both thresholds and emits both events", async () => {
      const newTrigger = parseUnits("0.25", 18);
      const newReset = parseUnits("0.12", 18);
      const tx = await oracle.setThresholds(assetA, newTrigger, newReset);
      await expect(tx).to.emit(oracle, "TriggerThresholdSet").withArgs(assetA, DEFAULT_THRESHOLD, newTrigger);
      await expect(tx).to.emit(oracle, "ResetThresholdSet").withArgs(assetA, DEFAULT_RESET_THRESHOLD, newReset);

      const state = await oracle.assetProtectionConfig(assetA);
      expect(state.triggerThreshold).to.equal(newTrigger);
      expect(state.resetThreshold).to.equal(newReset);
    });

    it("only emits TriggerThresholdSet when only trigger changes", async () => {
      const newTrigger = parseUnits("0.25", 18);
      const tx = await oracle.setThresholds(assetA, newTrigger, DEFAULT_RESET_THRESHOLD);
      await expect(tx).to.emit(oracle, "TriggerThresholdSet").withArgs(assetA, DEFAULT_THRESHOLD, newTrigger);
      await expect(tx).to.not.emit(oracle, "ResetThresholdSet");
    });

    it("only emits ResetThresholdSet when only reset changes", async () => {
      const newReset = parseUnits("0.08", 18);
      const tx = await oracle.setThresholds(assetA, DEFAULT_THRESHOLD, newReset);
      await expect(tx).to.not.emit(oracle, "TriggerThresholdSet");
      await expect(tx).to.emit(oracle, "ResetThresholdSet").withArgs(assetA, DEFAULT_RESET_THRESHOLD, newReset);
    });

    it("emits no events when neither changes", async () => {
      const tx = await oracle.setThresholds(assetA, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD);
      await expect(tx).to.not.emit(oracle, "TriggerThresholdSet");
      await expect(tx).to.not.emit(oracle, "ResetThresholdSet");
    });

    it("reverts when caller is unauthorized", async () => {
      acm.isAllowedToCall.returns(false);
      await expect(
        oracle.setThresholds(assetA, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD),
      ).to.be.revertedWithCustomError(oracle, "Unauthorized");
    });

    it("reverts when asset is zero address", async () => {
      await expect(
        oracle.setThresholds(addr0000, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD),
      ).to.be.revertedWithCustomError(oracle, "ZeroAddressNotAllowed");
    });

    it("reverts when not initialized", async () => {
      await expect(
        oracle.setThresholds(assetB, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD),
      ).to.be.revertedWithCustomError(oracle, "MarketNotInitialized");
    });

    it("reverts when trigger below MIN_THRESHOLD", async () => {
      await expect(
        oracle.setThresholds(assetA, MIN_THRESHOLD.sub(1), DEFAULT_RESET_THRESHOLD),
      ).to.be.revertedWithCustomError(oracle, "ThresholdBelowMinimum");
    });

    it("reverts when trigger above MAX_THRESHOLD", async () => {
      await expect(
        oracle.setThresholds(assetA, MAX_THRESHOLD.add(1), DEFAULT_RESET_THRESHOLD),
      ).to.be.revertedWithCustomError(oracle, "ThresholdAboveMaximum");
    });

    it("reverts when reset >= trigger (InvalidResetThreshold)", async () => {
      await expect(oracle.setThresholds(assetA, DEFAULT_THRESHOLD, DEFAULT_THRESHOLD)).to.be.revertedWithCustomError(
        oracle,
        "InvalidResetThreshold",
      );
    });

    it("reverts when triggerThreshold is zero", async () => {
      await expect(oracle.setThresholds(assetA, 0, DEFAULT_RESET_THRESHOLD)).to.be.revertedWithCustomError(
        oracle,
        "ZeroValueNotAllowed",
      );
    });

    it("reverts when resetThreshold is zero", async () => {
      await expect(oracle.setThresholds(assetA, DEFAULT_THRESHOLD, 0)).to.be.revertedWithCustomError(
        oracle,
        "ZeroValueNotAllowed",
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 6. setAssetBoundedPricingEnabled
  // ────────────────────────────────────────────────────────────────────────

  describe("setAssetBoundedPricingEnabled", () => {
    beforeEach(async () => {
      await initAsset(assetA);
    });

    it("disables bounded pricing and emits event", async () => {
      const tx = await oracle.setAssetBoundedPricingEnabled(assetA, false);
      await expect(tx).to.emit(oracle, "BoundedPricingWhitelistUpdated").withArgs(assetA, false);
      expect(await oracle.isBoundedPricingEnabled(assetA)).to.equal(false);
    });

    it("enables bounded pricing and emits event", async () => {
      await oracle.setAssetBoundedPricingEnabled(assetA, false);
      const tx = await oracle.setAssetBoundedPricingEnabled(assetA, true);
      await expect(tx).to.emit(oracle, "BoundedPricingWhitelistUpdated").withArgs(assetA, true);
      expect(await oracle.isBoundedPricingEnabled(assetA)).to.equal(true);
    });

    it("setAssetBoundedPricingEnabled(true) on already-enabled is a no-op", async () => {
      const tx = await oracle.setAssetBoundedPricingEnabled(assetA, true);
      await expect(tx).to.not.emit(oracle, "BoundedPricingWhitelistUpdated");
    });

    it("reverts when caller is unauthorized", async () => {
      acm.isAllowedToCall.returns(false);
      await expect(oracle.setAssetBoundedPricingEnabled(assetA, false)).to.be.revertedWithCustomError(
        oracle,
        "Unauthorized",
      );
    });

    it("reverts when asset is zero address", async () => {
      await expect(oracle.setAssetBoundedPricingEnabled(addr0000, true)).to.be.revertedWithCustomError(
        oracle,
        "ZeroAddressNotAllowed",
      );
    });

    it("reverts when not initialized", async () => {
      await expect(oracle.setAssetBoundedPricingEnabled(assetB, true)).to.be.revertedWithCustomError(
        oracle,
        "MarketNotInitialized",
      );
    });

    it("reverts when disabling with active protection", async () => {
      await initAssetWithWindow(assetB);

      // Trigger protection via pump: spot > MIN_PRICE * 1.2 = 1.08
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetB).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenB.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetB)).to.equal(true);

      await expect(oracle.setAssetBoundedPricingEnabled(assetB, false)).to.be.revertedWithCustomError(
        oracle,
        "ProtectedPriceActive",
      );
    });

    it("price functions return spot after disabling bounded pricing", async () => {
      await initAssetWithWindow(assetB);
      // Set a pump spot that would trigger bounded pricing
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetB).returns(pumpSpot);

      // View detects deviation → returns bounded (MIN_PRICE)
      expect(await oracle.getBoundedCollateralPriceView(vTokenB.address)).to.equal(MIN_PRICE);

      // Disable bounded pricing (protection not yet stored active, so this succeeds)
      await oracle.setAssetBoundedPricingEnabled(assetB, false);

      // Same pump spot, but now returns raw spot — not bounded
      expect(await oracle.getBoundedCollateralPriceView(vTokenB.address)).to.equal(pumpSpot);
      expect(await oracle.getBoundedDebtPriceView(vTokenB.address)).to.equal(pumpSpot);
      const collateral = await oracle.callStatic.getBoundedCollateralPrice(vTokenB.address);
      expect(collateral).to.equal(pumpSpot);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 6b. setCachingEnabled
  // ────────────────────────────────────────────────────────────────────────

  describe("setCachingEnabled", () => {
    beforeEach(async () => {
      await initAsset(assetA);
    });

    it("disables caching and emits CachingEnabledUpdated", async () => {
      const tx = await oracle.setCachingEnabled(assetA, false);
      await expect(tx).to.emit(oracle, "CachingEnabledUpdated").withArgs(assetA, true, false);
      const state = await oracle.assetProtectionConfig(assetA);
      expect(state.cachingEnabled).to.equal(false);
    });

    it("re-enables caching and emits CachingEnabledUpdated", async () => {
      await oracle.setCachingEnabled(assetA, false);
      const tx = await oracle.setCachingEnabled(assetA, true);
      await expect(tx).to.emit(oracle, "CachingEnabledUpdated").withArgs(assetA, false, true);
      const state = await oracle.assetProtectionConfig(assetA);
      expect(state.cachingEnabled).to.equal(true);
    });

    it("reverts when caller is unauthorized", async () => {
      acm.isAllowedToCall.returns(false);
      await expect(oracle.setCachingEnabled(assetA, false)).to.be.revertedWithCustomError(oracle, "Unauthorized");
    });

    it("reverts when asset has not been initialized", async () => {
      await expect(oracle.setCachingEnabled(assetB, false)).to.be.revertedWithCustomError(
        oracle,
        "MarketNotInitialized",
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 7. updateMinPrice
  // ────────────────────────────────────────────────────────────────────────

  describe("updateMinPrice", () => {
    beforeEach(async () => {
      await initAssetWithWindow(assetA);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
    });

    it("updates minPrice and emits event", async () => {
      const newMin = parseUnits("0.85", 18);
      const tx = await oracle.updateMinPrice(assetA, newMin);
      await expect(tx).to.emit(oracle, "MinPriceUpdated").withArgs(assetA, MIN_PRICE, newMin);
      const state = await oracle.assetProtectionConfig(assetA);
      expect(state.minPrice).to.equal(newMin);
    });

    it("allows setting price within keeper deadband (not enforced on-chain)", async () => {
      // newMin close to current MIN_PRICE (within 5% deadband)
      const newMin = MIN_PRICE.sub(MIN_PRICE.mul(3).div(100)); // 3% below current min
      await expect(oracle.updateMinPrice(assetA, newMin)).to.not.be.reverted;
    });

    it("reverts when caller is unauthorized", async () => {
      acm.isAllowedToCall.returns(false);
      await expect(oracle.updateMinPrice(assetA, parseUnits("0.85", 18))).to.be.revertedWithCustomError(
        oracle,
        "Unauthorized",
      );
    });

    it("reverts when asset is zero address", async () => {
      await expect(oracle.updateMinPrice(addr0000, parseUnits("0.85", 18))).to.be.revertedWithCustomError(
        oracle,
        "ZeroAddressNotAllowed",
      );
    });

    it("reverts when price is zero", async () => {
      await expect(oracle.updateMinPrice(assetA, 0)).to.be.revertedWithCustomError(oracle, "ZeroPriceNotAllowed");
    });

    it("reverts when not initialized", async () => {
      await expect(oracle.updateMinPrice(assetB, parseUnits("0.85", 18))).to.be.revertedWithCustomError(
        oracle,
        "MarketNotInitialized",
      );
    });

    it("reverts when newMin > currentSpot", async () => {
      const aboveSpot = SPOT_PRICE.add(1);
      await expect(oracle.updateMinPrice(assetA, aboveSpot)).to.be.revertedWithCustomError(oracle, "InvalidMinPrice");
    });

    it("reverts when newMin > maxPrice", async () => {
      // Set spot above maxPrice so the spot constraint passes; the maxPrice check is what reverts
      resilientOracle.getPrice.whenCalledWith(assetA).returns(MAX_PRICE.add(parseUnits("0.05", 18)));
      const aboveMax = MAX_PRICE.add(1);
      await expect(oracle.updateMinPrice(assetA, aboveMax)).to.be.revertedWithCustomError(oracle, "InvalidMinPrice");
    });

    it("succeeds when newMin == maxPrice == spot (full convergence)", async () => {
      // Spot equal to maxPrice so newMin = maxPrice = spot is valid under the relaxed semantics
      resilientOracle.getPrice.whenCalledWith(assetA).returns(MAX_PRICE);
      await expect(oracle.updateMinPrice(assetA, MAX_PRICE)).to.not.be.reverted;
      const state = await oracle.assetProtectionConfig(assetA);
      expect(state.minPrice).to.equal(MAX_PRICE);
      expect(state.maxPrice).to.equal(MAX_PRICE);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 8. updateMaxPrice
  // ────────────────────────────────────────────────────────────────────────

  describe("updateMaxPrice", () => {
    beforeEach(async () => {
      await initAssetWithWindow(assetA);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
    });

    it("updates maxPrice and emits event", async () => {
      const newMax = parseUnits("1.15", 18);
      const tx = await oracle.updateMaxPrice(assetA, newMax);
      await expect(tx).to.emit(oracle, "MaxPriceUpdated").withArgs(assetA, MAX_PRICE, newMax);
      const state = await oracle.assetProtectionConfig(assetA);
      expect(state.maxPrice).to.equal(newMax);
    });

    it("reverts when caller is unauthorized", async () => {
      acm.isAllowedToCall.returns(false);
      await expect(oracle.updateMaxPrice(assetA, parseUnits("1.15", 18))).to.be.revertedWithCustomError(
        oracle,
        "Unauthorized",
      );
    });

    it("reverts when asset is zero address", async () => {
      await expect(oracle.updateMaxPrice(addr0000, parseUnits("1.15", 18))).to.be.revertedWithCustomError(
        oracle,
        "ZeroAddressNotAllowed",
      );
    });

    it("reverts when price is zero", async () => {
      await expect(oracle.updateMaxPrice(assetA, 0)).to.be.revertedWithCustomError(oracle, "ZeroPriceNotAllowed");
    });

    it("reverts when not initialized", async () => {
      await expect(oracle.updateMaxPrice(assetB, parseUnits("1.15", 18))).to.be.revertedWithCustomError(
        oracle,
        "MarketNotInitialized",
      );
    });

    it("reverts when newMax < currentSpot", async () => {
      const belowSpot = SPOT_PRICE.sub(1);
      await expect(oracle.updateMaxPrice(assetA, belowSpot)).to.be.revertedWithCustomError(oracle, "InvalidMaxPrice");
    });

    it("reverts when newMax < minPrice", async () => {
      // Set spot below minPrice so the spot constraint passes; the minPrice check is what reverts
      resilientOracle.getPrice.whenCalledWith(assetA).returns(MIN_PRICE.sub(parseUnits("0.05", 18)));
      const belowMin = MIN_PRICE.sub(1);
      await expect(oracle.updateMaxPrice(assetA, belowMin)).to.be.revertedWithCustomError(oracle, "InvalidMaxPrice");
    });

    it("succeeds when newMax == minPrice == spot (full convergence)", async () => {
      // Spot equal to minPrice so newMax = minPrice = spot is valid under the relaxed semantics
      resilientOracle.getPrice.whenCalledWith(assetA).returns(MIN_PRICE);
      await expect(oracle.updateMaxPrice(assetA, MIN_PRICE)).to.not.be.reverted;
      const state = await oracle.assetProtectionConfig(assetA);
      expect(state.minPrice).to.equal(MIN_PRICE);
      expect(state.maxPrice).to.equal(MIN_PRICE);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 9. exitProtectionMode
  // ────────────────────────────────────────────────────────────────────────

  describe("exitProtectionMode", () => {
    it("disables protection after governance raises reset threshold", async () => {
      await initAssetWithWindow(assetA);

      // Trigger via pump: pumpSpot > MIN_PRICE * 1.2 = 1.08
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Wait cooldown
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);

      // Post-trigger: min=0.9, max=pumpSpot (~1.08). Range exceeds default reset threshold (10%).
      // Governance raises reset threshold above current range to allow disable.
      const stateAfter = await oracle.assetProtectionConfig(assetA);
      const range = stateAfter.maxPrice.sub(stateAfter.minPrice).mul(EXP_SCALE).div(stateAfter.minPrice);
      const newResetThreshold = range.add(parseUnits("0.001", 18));

      // resetThreshold must remain < triggerThreshold; raise triggerThreshold first if needed
      const currentTrigger = stateAfter.triggerThreshold;
      if (newResetThreshold.gte(currentTrigger)) {
        await oracle.setThresholds(assetA, newResetThreshold.add(parseUnits("0.01", 18)), newResetThreshold);
      } else {
        await oracle.setThresholds(assetA, currentTrigger, newResetThreshold);
      }

      const tx = await oracle.exitProtectionMode(assetA);
      await expect(tx).to.emit(oracle, "ProtectionModeExited").withArgs(assetA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);
    });

    it("prices revert to spot after exitProtectionMode", async () => {
      await initAssetWithWindow(assetA);

      // Trigger via pump
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // During protection: collateral = min(pumpSpot, MIN_PRICE) = MIN_PRICE (bounded)
      const boundedCollateral = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      expect(boundedCollateral).to.equal(MIN_PRICE);

      // Disable protection
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);
      const stateAfter = await oracle.assetProtectionConfig(assetA);
      const range = stateAfter.maxPrice.sub(stateAfter.minPrice).mul(EXP_SCALE).div(stateAfter.minPrice);
      const newReset = range.add(parseUnits("0.001", 18));
      const currentTrigger = stateAfter.triggerThreshold;
      if (newReset.gte(currentTrigger)) {
        await oracle.setThresholds(assetA, newReset.add(parseUnits("0.01", 18)), newReset);
      } else {
        await oracle.setThresholds(assetA, currentTrigger, newReset);
      }
      await oracle.exitProtectionMode(assetA);

      // Verify lastProtectionTriggeredAt is reset to 0 on disable
      const stateDisabled = await oracle.assetProtectionConfig(assetA);
      expect(stateDisabled.lastProtectionTriggeredAt).to.equal(0);
      expect(stateDisabled.currentlyUsingProtectedPrice).to.equal(false);

      // After disable: set spot back to normal
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);

      // Should return spot, not bounded price
      const collateral = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      const debt = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);
      expect(collateral).to.equal(SPOT_PRICE);
      expect(debt).to.equal(SPOT_PRICE);
    });

    it("reverts when caller is unauthorized", async () => {
      await initAsset(assetA);
      acm.isAllowedToCall.returns(false);
      await expect(oracle.exitProtectionMode(assetA)).to.be.revertedWithCustomError(oracle, "Unauthorized");
    });

    it("reverts when protection is not active", async () => {
      await initAsset(assetA);
      await expect(oracle.exitProtectionMode(assetA)).to.be.revertedWithCustomError(oracle, "ProtectedPriceInactive");
    });

    it("reverts when cooldown has not elapsed", async () => {
      await initAssetWithWindow(assetA);
      // Trigger protection
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      await expect(oracle.exitProtectionMode(assetA)).to.be.revertedWithCustomError(oracle, "CooldownNotElapsed");
    });

    it("reverts when range not converged", async () => {
      await initAssetWithWindow(assetA);
      // Trigger protection
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      // Wait cooldown
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);

      // Range still wide -> reverts
      await expect(oracle.exitProtectionMode(assetA)).to.be.revertedWithCustomError(oracle, "PriceRangeNotConverged");
    });

    it("reverts when rangeRatio exactly at resetThreshold (uses >=)", async () => {
      await initAssetWithWindow(assetA);

      // Trigger
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);

      // Compute current range ratio and set resetThreshold exactly equal to it
      const stateAfter = await oracle.assetProtectionConfig(assetA);
      const rangeRatio = stateAfter.maxPrice.sub(stateAfter.minPrice).mul(EXP_SCALE).div(stateAfter.minPrice);

      // Raise triggerThreshold if needed so we can set resetThreshold = rangeRatio
      const currentTrigger = stateAfter.triggerThreshold;
      if (rangeRatio.gte(currentTrigger)) {
        await oracle.setThresholds(assetA, rangeRatio.add(parseUnits("0.01", 18)), rangeRatio);
      } else {
        await oracle.setThresholds(assetA, currentTrigger, rangeRatio);
      }

      // Set resetThreshold = rangeRatio (exactly equal, should revert since >=)
      await expect(oracle.exitProtectionMode(assetA)).to.be.revertedWithCustomError(oracle, "PriceRangeNotConverged");
    });

    it("succeeds when rangeRatio at resetThreshold - 1 wei", async () => {
      await initAssetWithWindow(assetA);

      // Trigger
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);

      // Set resetThreshold = rangeRatio + 1 (should succeed)
      const stateAfter = await oracle.assetProtectionConfig(assetA);
      const rangeRatio = stateAfter.maxPrice.sub(stateAfter.minPrice).mul(EXP_SCALE).div(stateAfter.minPrice);

      // Raise triggerThreshold if needed
      const currentTrigger = stateAfter.triggerThreshold;
      if (rangeRatio.add(1).gte(currentTrigger)) {
        await oracle.setThresholds(assetA, rangeRatio.add(parseUnits("0.01", 18)), rangeRatio.add(1));
      } else {
        await oracle.setThresholds(assetA, currentTrigger, rangeRatio.add(1));
      }

      await expect(oracle.exitProtectionMode(assetA)).to.not.be.reverted;
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 9b. syncPriceBoundsAndProtections (keeper batch)
  // ────────────────────────────────────────────────────────────────────────

  describe("syncPriceBoundsAndProtections", () => {
    // KeeperAction enum: 0 = SetMinPrice, 1 = SetMaxPrice, 2 = ExitProtectionMode
    const SetMinPrice = 0;
    const SetMaxPrice = 1;
    const ExitProtectionMode = 2;

    beforeEach(async () => {
      await initAssetWithWindow(assetA);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
    });

    it("reverts when caller is unauthorized", async () => {
      acm.isAllowedToCall.returns(false);
      await expect(
        oracle.syncPriceBoundsAndProtections([{ asset: assetA, action: SetMinPrice, value: parseUnits("0.85", 18) }]),
      ).to.be.revertedWithCustomError(oracle, "Unauthorized");
    });

    it("succeeds with empty array (no-op)", async () => {
      await expect(oracle.syncPriceBoundsAndProtections([])).to.not.be.reverted;
    });

    it("single SetMinPrice item updates the asset and emits MinPriceUpdated", async () => {
      const newMin = parseUnits("0.85", 18);
      const tx = await oracle.syncPriceBoundsAndProtections([{ asset: assetA, action: SetMinPrice, value: newMin }]);
      await expect(tx).to.emit(oracle, "MinPriceUpdated").withArgs(assetA, MIN_PRICE, newMin);
      const state = await oracle.assetProtectionConfig(assetA);
      expect(state.minPrice).to.equal(newMin);
    });

    it("single SetMaxPrice item updates the asset and emits MaxPriceUpdated", async () => {
      const newMax = parseUnits("1.15", 18);
      const tx = await oracle.syncPriceBoundsAndProtections([{ asset: assetA, action: SetMaxPrice, value: newMax }]);
      await expect(tx).to.emit(oracle, "MaxPriceUpdated").withArgs(assetA, MAX_PRICE, newMax);
      const state = await oracle.assetProtectionConfig(assetA);
      expect(state.maxPrice).to.equal(newMax);
    });

    it("single ExitProtectionMode item clears protection and emits ProtectionModeExited", async () => {
      // Pre-arm: pump trigger so protection is active
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Cooldown elapses; raise reset threshold above the range so exit gate passes
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);
      const stateAfter = await oracle.assetProtectionConfig(assetA);
      const range = stateAfter.maxPrice.sub(stateAfter.minPrice).mul(EXP_SCALE).div(stateAfter.minPrice);
      const newReset = range.add(parseUnits("0.001", 18));
      const currentTrigger = stateAfter.triggerThreshold;
      if (newReset.gte(currentTrigger)) {
        await oracle.setThresholds(assetA, newReset.add(parseUnits("0.01", 18)), newReset);
      } else {
        await oracle.setThresholds(assetA, currentTrigger, newReset);
      }

      const tx = await oracle.syncPriceBoundsAndProtections([{ asset: assetA, action: ExitProtectionMode, value: 0 }]);
      await expect(tx).to.emit(oracle, "ProtectionModeExited").withArgs(assetA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);
    });

    it("mixed batch (SetMin, SetMax, Exit) converges and exits in one tx", async () => {
      // Pre-arm: pump trigger
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Spot stabilises somewhere inside the post-trigger window
      const stableSpot = MIN_PRICE.add(pumpSpot).div(2);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(stableSpot);

      // Wait out cooldown so the Exit action is admissible
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);

      const tx = await oracle.syncPriceBoundsAndProtections([
        { asset: assetA, action: SetMinPrice, value: stableSpot },
        { asset: assetA, action: SetMaxPrice, value: stableSpot },
        { asset: assetA, action: ExitProtectionMode, value: 0 },
      ]);

      await expect(tx)
        .to.emit(oracle, "MinPriceUpdated")
        .and.to.emit(oracle, "MaxPriceUpdated")
        .and.to.emit(oracle, "ProtectionModeExited")
        .withArgs(assetA);

      const state = await oracle.assetProtectionConfig(assetA);
      expect(state.minPrice).to.equal(stableSpot);
      expect(state.maxPrice).to.equal(stableSpot);
      expect(state.currentlyUsingProtectedPrice).to.equal(false);
    });

    it("revert in any item rolls back the whole batch", async () => {
      // Item 1 is a valid SetMinPrice; item 2 is SetMinPrice with value above current spot — must revert.
      // After revert, the asset's minPrice must remain at its pre-batch value (no partial application).
      const validNewMin = parseUnits("0.85", 18);
      const stateBefore = await oracle.assetProtectionConfig(assetA);
      const aboveSpot = SPOT_PRICE.add(parseUnits("0.5", 18));

      await expect(
        oracle.syncPriceBoundsAndProtections([
          { asset: assetA, action: SetMinPrice, value: validNewMin },
          { asset: assetA, action: SetMinPrice, value: aboveSpot },
        ]),
      ).to.be.revertedWithCustomError(oracle, "InvalidMinPrice");

      const stateAfter = await oracle.assetProtectionConfig(assetA);
      expect(stateAfter.minPrice).to.equal(stateBefore.minPrice);
    });

    it("reverts with PriceExceedsUint128 when a SetMin/SetMax value overflows uint128", async () => {
      const overflow = BigNumber.from(2).pow(128);
      await expect(
        oracle.syncPriceBoundsAndProtections([{ asset: assetA, action: SetMinPrice, value: overflow }]),
      ).to.be.revertedWithCustomError(oracle, "PriceExceedsUint128");
    });

    it("re-uses per-action validation: SetMinPrice with value > spot still reverts with InvalidMinPrice", async () => {
      const aboveSpot = SPOT_PRICE.add(1);
      await expect(
        oracle.syncPriceBoundsAndProtections([{ asset: assetA, action: SetMinPrice, value: aboveSpot }]),
      ).to.be.revertedWithCustomError(oracle, "InvalidMinPrice");
    });

    it("re-uses per-action validation: ExitProtectionMode before cooldown still reverts with CooldownNotElapsed", async () => {
      // Pre-arm protection without waiting cooldown
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      await expect(
        oracle.syncPriceBoundsAndProtections([{ asset: assetA, action: ExitProtectionMode, value: 0 }]),
      ).to.be.revertedWithCustomError(oracle, "CooldownNotElapsed");
    });

    // Note: the catch-all `revert InvalidKeeperAction(...)` branch is defensive for future enum
    // additions. With the current 3-value enum, Solidity's abi-boundary enum range check rejects
    // out-of-range action values before the function body executes, so the branch is unreachable
    // through a well-formed external call and is left untested.
  });

  // ────────────────────────────────────────────────────────────────────────
  // 10. getBoundedCollateralPrice
  // ────────────────────────────────────────────────────────────────────────

  describe("getBoundedCollateralPrice", () => {
    beforeEach(async () => {
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
    });

    it("returns spot when not whitelisted", async () => {
      await initAsset(assetA);
      await oracle.setAssetBoundedPricingEnabled(assetA, false);
      const price = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      expect(price).to.equal(SPOT_PRICE);
      // Verify oracle was called
      expect(resilientOracle.getPrice).to.have.been.calledWith(assetA);
    });

    it("returns spot when whitelisted, no deviation", async () => {
      await initAssetWithWindow(assetA);
      const price = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      expect(price).to.equal(SPOT_PRICE);
    });

    it("expands window when spot < minPrice", async () => {
      await initAssetWithWindow(assetA);
      const lowSpot = MIN_PRICE.sub(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(lowSpot);
      const tx = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(tx).to.emit(oracle, "MinPriceUpdated").withArgs(assetA, MIN_PRICE, lowSpot);
    });

    it("expands window when spot > maxPrice", async () => {
      await initAssetWithWindow(assetA);
      const highSpot = MAX_PRICE.add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(highSpot);
      const tx = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(tx).to.emit(oracle, "MaxPriceUpdated").withArgs(assetA, MAX_PRICE, highSpot);
    });

    it("triggers protection on pump and returns minPrice (exact arithmetic)", async () => {
      await initAssetWithWindow(assetA);
      // upperBound = MIN_PRICE * (1 + threshold) = 0.9 * 1.2 = 1.08
      const upperBound = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE);
      const pumpSpot = upperBound.add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);

      const tx = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(tx).to.emit(oracle, "ProtectionTriggered");

      // Verify state
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Read bounded price after trigger (protection already active, no re-trigger)
      // collateral = min(pumpSpot, MIN_PRICE) = MIN_PRICE
      const boundedPrice = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      expect(boundedPrice).to.equal(MIN_PRICE);
    });

    it("triggers protection on crash and returns spot (exact arithmetic)", async () => {
      // Use a tight window so crashSpot falls below localMin, causing window expansion
      const localMin = parseUnits("0.995", 18);
      const localMax = parseUnits("1.005", 18);
      await initAssetWithWindow(assetA, localMin, localMax);

      // lowerBound = localMax * (1 - threshold) = 1.005 * 0.8 = 0.804
      const lowerBound = localMax.mul(EXP_SCALE.sub(DEFAULT_THRESHOLD)).div(EXP_SCALE);
      const crashSpot = lowerBound.sub(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(crashSpot);

      const tx = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(tx).to.emit(oracle, "ProtectionTriggered");

      // After expansion, min = crashSpot (since crashSpot < localMin).
      // collateral = min(crashSpot, crashSpot) = crashSpot
      const boundedPrice = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      expect(boundedPrice).to.equal(crashSpot);
    });

    it("expands window min and max while protection is already active", async () => {
      await initAssetWithWindow(assetA);

      // Trigger protection via pump
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Spot drops below min — window expands downward, deviation still exceeded so event re-emitted
      const lowSpot = parseUnits("0.8", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(lowSpot);
      const tx1 = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(tx1).to.emit(oracle, "MinPriceUpdated").withArgs(assetA, MIN_PRICE, lowSpot);
      await expect(tx1).to.emit(oracle, "ProtectionTriggered");

      // Spot rises above current max — window expands upward, deviation still exceeded
      const stateAfterMin = await oracle.assetProtectionConfig(assetA);
      const highSpot = stateAfterMin.maxPrice.add(parseUnits("0.5", 18));
      resilientOracle.getPrice.whenCalledWith(assetA).returns(highSpot);
      const tx2 = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(tx2).to.emit(oracle, "MaxPriceUpdated");
      await expect(tx2).to.emit(oracle, "ProtectionTriggered");
    });

    it("returns spot for uninitialized asset (setTokenConfig never called)", async () => {
      // assetA is NOT initialized — isBoundedPricingEnabled defaults to false
      const price = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      expect(price).to.equal(SPOT_PRICE);

      const debtPrice = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);
      expect(debtPrice).to.equal(SPOT_PRICE);

      // Views also pass through to spot
      expect(await oracle.getBoundedCollateralPriceView(vTokenA.address)).to.equal(SPOT_PRICE);
      expect(await oracle.getBoundedDebtPriceView(vTokenA.address)).to.equal(SPOT_PRICE);
    });

    it("reverts when vToken is zero address", async () => {
      await initAsset(assetA);
      await expect(oracle.getBoundedCollateralPrice(addr0000)).to.be.revertedWithCustomError(
        oracle,
        "ZeroAddressNotAllowed",
      );
    });

    it("resolves native market to NATIVE_TOKEN_ADDR", async () => {
      const nativeAsset = NATIVE_TOKEN_ADDR;
      resilientOracle.getPrice.whenCalledWith(nativeAsset).returns(SPOT_PRICE);
      await initAssetWithWindow(nativeAsset);
      const price = await oracle.callStatic.getBoundedCollateralPrice(nativeMarket.address);
      expect(price).to.equal(SPOT_PRICE);
    });

    it("reverts with PriceExceedsUint128 when oracle returns > uint128 max", async () => {
      await initAsset(assetA);
      const overflowPrice = BigNumber.from(2).pow(128);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(overflowPrice);
      await expect(oracle.getBoundedCollateralPrice(vTokenA.address)).to.be.revertedWithCustomError(
        oracle,
        "PriceExceedsUint128",
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 11. getBoundedDebtPrice
  // ────────────────────────────────────────────────────────────────────────

  describe("getBoundedDebtPrice", () => {
    beforeEach(async () => {
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
    });

    it("returns spot when not whitelisted", async () => {
      await initAsset(assetA);
      await oracle.setAssetBoundedPricingEnabled(assetA, false);
      const price = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);
      expect(price).to.equal(SPOT_PRICE);
    });

    it("returns spot when no deviation", async () => {
      await initAssetWithWindow(assetA);
      const price = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);
      expect(price).to.equal(SPOT_PRICE);
    });

    it("returns spot on pump trigger (spot > max after expansion)", async () => {
      // Use a tight window so pumpSpot exceeds localMax, causing window expansion
      const localMin = parseUnits("0.995", 18);
      const localMax = parseUnits("1.005", 18);
      await initAssetWithWindow(assetA, localMin, localMax);

      // upperBound = 0.995 * 1.2 = 1.194
      const upperBound = localMin.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE);
      const pumpSpot = upperBound.add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);

      await oracle.getBoundedDebtPrice(vTokenA.address);
      // After expansion max = pumpSpot (since pumpSpot > localMax).
      // debt = max(pumpSpot, pumpSpot) = pumpSpot
      const price = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);
      expect(price).to.equal(pumpSpot);
    });

    it("returns maxPrice on crash trigger (spot < max)", async () => {
      await initAssetWithWindow(assetA);
      // lowerBound = MAX_PRICE * (1 - threshold) = 1.1 * 0.8 = 0.88
      const lowerBound = MAX_PRICE.mul(EXP_SCALE.sub(DEFAULT_THRESHOLD)).div(EXP_SCALE);
      const crashSpot = lowerBound.sub(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(crashSpot);

      await oracle.getBoundedDebtPrice(vTokenA.address);
      // After expansion, min = crashSpot. debt = max(spot, max).
      // crashSpot < MAX_PRICE, so max(crashSpot, MAX_PRICE) = MAX_PRICE
      const price = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);
      expect(price).to.equal(MAX_PRICE);
    });

    it("reverts when vToken is zero address", async () => {
      await initAsset(assetA);
      await expect(oracle.getBoundedDebtPrice(addr0000)).to.be.revertedWithCustomError(oracle, "ZeroAddressNotAllowed");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 12. getBoundedPrices
  // ────────────────────────────────────────────────────────────────────────

  describe("getBoundedPrices", () => {
    beforeEach(async () => {
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
    });

    it("returns (spot, spot) when not whitelisted", async () => {
      await initAsset(assetA);
      await oracle.setAssetBoundedPricingEnabled(assetA, false);
      const [collateral, debt] = await oracle.callStatic.getBoundedPrices(vTokenA.address);
      expect(collateral).to.equal(SPOT_PRICE);
      expect(debt).to.equal(SPOT_PRICE);
    });

    it("returns (spot, spot) when whitelisted, no deviation", async () => {
      await initAssetWithWindow(assetA);
      const [collateral, debt] = await oracle.callStatic.getBoundedPrices(vTokenA.address);
      expect(collateral).to.equal(SPOT_PRICE);
      expect(debt).to.equal(SPOT_PRICE);
    });

    it("returns (minPrice, maxPrice) when protection active (pump scenario)", async () => {
      await initAssetWithWindow(assetA);

      // Trigger protection via pump
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // collateral = min(pumpSpot, MIN_PRICE) = MIN_PRICE
      // After expansion max = pumpSpot (since pumpSpot > MAX_PRICE), debt = max(pumpSpot, pumpSpot) = pumpSpot
      const stateAfter = await oracle.assetProtectionConfig(assetA);
      const [collateral, debt] = await oracle.callStatic.getBoundedPrices(vTokenA.address);
      expect(collateral).to.equal(MIN_PRICE);
      expect(debt).to.equal(stateAfter.maxPrice);
    });

    it("both values match individual getBoundedCollateralPrice and getBoundedDebtPrice", async () => {
      await initAssetWithWindow(assetA);

      // Trigger protection via pump
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      const collateralPrice = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      const debtPrice = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);
      const [collateral, debt] = await oracle.callStatic.getBoundedPrices(vTokenA.address);

      expect(collateral).to.equal(collateralPrice);
      expect(debt).to.equal(debtPrice);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 13. View price functions (getBoundedCollateralPriceView, getBoundedDebtPriceView)
  // ────────────────────────────────────────────────────────────────────────

  describe("view price functions", () => {
    beforeEach(async () => {
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
    });

    it("returns spot when not whitelisted", async () => {
      await initAsset(assetA);
      await oracle.setAssetBoundedPricingEnabled(assetA, false);
      expect(await oracle.getBoundedCollateralPriceView(vTokenA.address)).to.equal(SPOT_PRICE);
      expect(await oracle.getBoundedDebtPriceView(vTokenA.address)).to.equal(SPOT_PRICE);
    });

    it("returns spot when no protection and no deviation", async () => {
      await initAssetWithWindow(assetA);
      expect(await oracle.getBoundedCollateralPriceView(vTokenA.address)).to.equal(SPOT_PRICE);
      expect(await oracle.getBoundedDebtPriceView(vTokenA.address)).to.equal(SPOT_PRICE);
    });

    it("returns bounded price when protection is stored active", async () => {
      await initAssetWithWindow(assetA);
      // Trigger protection first: pumpSpot > MIN_PRICE * 1.2 = 1.08
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // View should return bounded prices
      // collateral = min(pumpSpot, MIN_PRICE) = MIN_PRICE
      expect(await oracle.getBoundedCollateralPriceView(vTokenA.address)).to.equal(MIN_PRICE);
      // debt = max(pumpSpot, max). After expansion max = pumpSpot, so pumpSpot.
      const stateAfter = await oracle.assetProtectionConfig(assetA);
      expect(await oracle.getBoundedDebtPriceView(vTokenA.address)).to.equal(stateAfter.maxPrice);
    });

    it("simulated trigger: returns bounded price without state mutation", async () => {
      await initAssetWithWindow(assetA);
      // Spot exceeds deviation threshold but protection has NOT been triggered yet
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);

      // View should detect deviation and return bounded price
      // collateral = min(pumpSpot, MIN_PRICE) = MIN_PRICE
      expect(await oracle.getBoundedCollateralPriceView(vTokenA.address)).to.equal(MIN_PRICE);

      // Verify currentlyUsingProtectedPrice is still false (no state mutation)
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);
    });

    it("view and non-view return identical prices when protection is active (pump)", async () => {
      await initAssetWithWindow(assetA);
      // Trigger protection via pump
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      // Read from non-view (callStatic) and view
      const nonViewCollateral = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      const nonViewDebt = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);
      const viewCollateral = await oracle.getBoundedCollateralPriceView(vTokenA.address);
      const viewDebt = await oracle.getBoundedDebtPriceView(vTokenA.address);

      expect(nonViewCollateral).to.equal(viewCollateral);
      expect(nonViewDebt).to.equal(viewDebt);
    });

    it("view and non-view return identical prices when protection is active (crash)", async () => {
      const localMin = parseUnits("0.995", 18);
      const localMax = parseUnits("1.005", 18);
      await initAssetWithWindow(assetA, localMin, localMax);

      // Trigger protection via crash
      const lowerBound = localMax.mul(EXP_SCALE.sub(DEFAULT_THRESHOLD)).div(EXP_SCALE);
      const crashSpot = lowerBound.sub(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(crashSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);

      const nonViewCollateral = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
      const nonViewDebt = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);
      const viewCollateral = await oracle.getBoundedCollateralPriceView(vTokenA.address);
      const viewDebt = await oracle.getBoundedDebtPriceView(vTokenA.address);

      expect(nonViewCollateral).to.equal(viewCollateral);
      expect(nonViewDebt).to.equal(viewDebt);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 14. getBoundedPricesView
  // ────────────────────────────────────────────────────────────────────────

  describe("getBoundedPricesView", () => {
    beforeEach(async () => {
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
    });

    it("returns same as individual view functions", async () => {
      await initAssetWithWindow(assetA);

      // Trigger protection
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      const collateralView = await oracle.getBoundedCollateralPriceView(vTokenA.address);
      const debtView = await oracle.getBoundedDebtPriceView(vTokenA.address);
      const [collateral, debt] = await oracle.getBoundedPricesView(vTokenA.address);

      expect(collateral).to.equal(collateralView);
      expect(debt).to.equal(debtView);
    });

    it("works with cache (after updateProtectionState)", async () => {
      await initAssetWithWindow(assetA);

      // Deploy the caller helper to test transient cache within the same tx
      const callerFactory = await ethers.getContractFactory("DeviationBoundedOracleCaller", admin);
      const caller = await callerFactory.deploy(oracle.address);

      // Trigger protection first so bounded prices differ from spot
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      // Use caller to updateProtectionState then read view within same tx
      const [collateral, debt] = await caller.callStatic.updateAndGetBothPrices(vTokenA.address);

      // Should match view prices
      const collateralView = await oracle.getBoundedCollateralPriceView(vTokenA.address);
      const debtView = await oracle.getBoundedDebtPriceView(vTokenA.address);
      expect(collateral).to.equal(collateralView);
      expect(debt).to.equal(debtView);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 15. updateProtectionState
  // ────────────────────────────────────────────────────────────────────────

  describe("updateProtectionState", () => {
    beforeEach(async () => {
      await initAssetWithWindow(assetA);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
    });

    it("expands window and triggers protection for whitelisted asset", async () => {
      // pumpSpot > MIN_PRICE * 1.2 = 1.08
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);

      const tx = await oracle.updateProtectionState(vTokenA.address);
      await expect(tx).to.emit(oracle, "ProtectionTriggered");
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);
    });

    it("is a no-op for non-whitelisted asset", async () => {
      await oracle.setAssetBoundedPricingEnabled(assetA, false);
      // Should not revert
      await expect(oracle.updateProtectionState(vTokenA.address)).to.not.be.reverted;
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);
    });

    it("reverts with PriceExceedsUint128 when oracle returns > uint128 max", async () => {
      const overflowPrice = BigNumber.from(2).pow(128);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(overflowPrice);
      await expect(oracle.updateProtectionState(vTokenA.address)).to.be.revertedWithCustomError(
        oracle,
        "PriceExceedsUint128",
      );
    });

    it("expands window without triggering protection", async () => {
      // Use 30% threshold so spot=1.15 expands max but stays under upperBound (0.9 * 1.3 = 1.17)
      await initAssetWithWindow(
        assetB,
        MIN_PRICE,
        MAX_PRICE,
        DEFAULT_COOLDOWN,
        parseUnits("0.3", 18),
        DEFAULT_RESET_THRESHOLD,
      );

      const spot = parseUnits("1.15", 18);
      resilientOracle.getPrice.whenCalledWith(assetB).returns(spot);

      const tx = await oracle.updateProtectionState(vTokenB.address);
      await expect(tx).to.emit(oracle, "MaxPriceUpdated").withArgs(assetB, MAX_PRICE, spot);
      await expect(tx).to.not.emit(oracle, "ProtectionTriggered");
      expect(await oracle.currentlyUsingProtectedPrice(assetB)).to.equal(false);
    });

    it("triggers protection without expanding window", async () => {
      // Wide window [0.8, 1.3] — spot=1.0 is inside, no expansion needed
      // But upperBound = 0.8 * 1.2 = 0.96 → spot 1.0 > 0.96 → triggers
      await initAssetWithWindow(assetB, parseUnits("0.8", 18), parseUnits("1.3", 18));

      resilientOracle.getPrice.whenCalledWith(assetB).returns(SPOT_PRICE);

      const tx = await oracle.updateProtectionState(vTokenB.address);
      await expect(tx).to.emit(oracle, "ProtectionTriggered");
      await expect(tx).to.not.emit(oracle, "MinPriceUpdated");
      await expect(tx).to.not.emit(oracle, "MaxPriceUpdated");
      expect(await oracle.currentlyUsingProtectedPrice(assetB)).to.equal(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 15b. transient cache gating (DBO.cachingEnabled)
  // ────────────────────────────────────────────────────────────────────────

  describe("transient cache gating (DBO.cachingEnabled)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let caller: any;

    beforeEach(async () => {
      await initAssetWithWindow(assetA);
      const callerFactory = await ethers.getContractFactory("DeviationBoundedOracleCaller", admin);
      caller = await callerFactory.deploy(oracle.address);
      resilientOracle.getPrice.reset();
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
    });

    it("view reads hit the cache when cachingEnabled is true (default)", async () => {
      await caller.updateAndGetBothPrices(vTokenA.address);

      // updateProtectionState fetches the spot once; both view getters read from the
      // transient cache and do not re-query the ResilientOracle.
      expect(resilientOracle.getPrice).to.have.callCount(1);
    });

    it("view reads bypass the cache when cachingEnabled is false", async () => {
      await oracle.setCachingEnabled(assetA, false);
      resilientOracle.getPrice.reset();
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);

      await caller.updateAndGetBothPrices(vTokenA.address);

      // updateProtectionState fetches once; each view getter recomputes and fetches again.
      expect(resilientOracle.getPrice).to.have.callCount(3);
    });

    it("disabling caching mid-window does not serve stale prices from prior cache writes", async () => {
      // Seed the cache first by running update with the original spot.
      await caller.updateAndGetBothPrices(vTokenA.address);

      // Disable caching and change the spot — views must recompute with the new spot.
      await oracle.setCachingEnabled(assetA, false);
      const newSpot = parseUnits("1.05", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(newSpot);

      const [collateral, debt] = await caller.callStatic.updateAndGetBothPrices(vTokenA.address);
      expect(collateral).to.equal(newSpot);
      expect(debt).to.equal(newSpot);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 16. isBoundedPricingEnabled
  // ────────────────────────────────────────────────────────────────────────

  describe("isBoundedPricingEnabled", () => {
    it("returns true for enabled asset", async () => {
      await initAsset(assetA);
      expect(await oracle.isBoundedPricingEnabled(assetA)).to.equal(true);
    });

    it("returns false for disabled asset", async () => {
      await initAsset(assetA);
      await oracle.setAssetBoundedPricingEnabled(assetA, false);
      expect(await oracle.isBoundedPricingEnabled(assetA)).to.equal(false);
    });

    it("returns false for uninitialized asset", async () => {
      expect(await oracle.isBoundedPricingEnabled(assetA)).to.equal(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 17. currentlyUsingProtectedPrice
  // ────────────────────────────────────────────────────────────────────────

  describe("currentlyUsingProtectedPrice", () => {
    it("returns true when protection is active", async () => {
      await initAssetWithWindow(assetA);
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);
    });

    it("returns false when protection is not active", async () => {
      await initAsset(assetA);
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);
    });

    it("returns false for uninitialized asset", async () => {
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 18. canExitProtection
  // ────────────────────────────────────────────────────────────────────────

  describe("canExitProtection", () => {
    it("returns false when protection is not active", async () => {
      await initAsset(assetA);
      expect(await oracle.canExitProtection(assetA)).to.equal(false);
    });

    it("returns false for uninitialized asset", async () => {
      expect(await oracle.canExitProtection(assetA)).to.equal(false);
    });

    it("returns false before cooldown elapsed", async () => {
      await initAssetWithWindow(assetA);
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      expect(await oracle.canExitProtection(assetA)).to.equal(false);
    });

    it("returns false when range not converged (cooldown elapsed but range wide)", async () => {
      await initAssetWithWindow(assetA);
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);

      // Range is wide after pump expansion
      expect(await oracle.canExitProtection(assetA)).to.equal(false);
    });

    it("returns true when cooldown elapsed and range converged", async () => {
      await initAssetWithWindow(assetA);

      // Trigger
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);

      // Raise reset threshold so range < resetThreshold
      const stateAfter = await oracle.assetProtectionConfig(assetA);
      const rangeRatio = stateAfter.maxPrice.sub(stateAfter.minPrice).mul(EXP_SCALE).div(stateAfter.minPrice);
      const newReset = rangeRatio.add(parseUnits("0.001", 18));

      // Raise triggerThreshold if needed so we can set resetThreshold
      const currentTrigger = stateAfter.triggerThreshold;
      if (newReset.gte(currentTrigger)) {
        await oracle.setThresholds(assetA, newReset.add(parseUnits("0.01", 18)), newReset);
      } else {
        await oracle.setThresholds(assetA, currentTrigger, newReset);
      }
      expect(await oracle.canExitProtection(assetA)).to.equal(true);
    });

    it("returns false when rangeRatio exactly at resetThreshold (boundary precision)", async () => {
      await initAssetWithWindow(assetA);

      // Trigger
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);

      // Set reset threshold exactly at range ratio
      const stateAfter = await oracle.assetProtectionConfig(assetA);
      const rangeRatio = stateAfter.maxPrice.sub(stateAfter.minPrice).mul(EXP_SCALE).div(stateAfter.minPrice);

      // Raise triggerThreshold if needed
      const currentTrigger = stateAfter.triggerThreshold;
      if (rangeRatio.gte(currentTrigger)) {
        await oracle.setThresholds(assetA, rangeRatio.add(parseUnits("0.01", 18)), rangeRatio);
      } else {
        await oracle.setThresholds(assetA, currentTrigger, rangeRatio);
      }
      // Uses < so exactly equal -> false
      expect(await oracle.canExitProtection(assetA)).to.equal(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 19. getInitializedAssets
  // ────────────────────────────────────────────────────────────────────────

  describe("getInitializedAssets", () => {
    it("returns all initialized assets", async () => {
      await initAsset(assetA);
      await initAsset(assetB);
      const initialized = await oracle.getInitializedAssets();
      expect(initialized).to.include(assetA);
      expect(initialized).to.include(assetB);
      expect(initialized.length).to.equal(2);
    });

    it("includes de-whitelisted assets", async () => {
      await initAsset(assetA);
      await initAsset(assetB);
      await oracle.setAssetBoundedPricingEnabled(assetB, false);

      const initialized = await oracle.getInitializedAssets();
      expect(initialized.length).to.equal(2);
      expect(initialized).to.include(assetA);
      expect(initialized).to.include(assetB);
    });

    it("returns empty when none", async () => {
      const initialized = await oracle.getInitializedAssets();
      expect(initialized.length).to.equal(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 20. getAllBoundedPricingEnabledAssets
  // ────────────────────────────────────────────────────────────────────────

  describe("getAllBoundedPricingEnabledAssets", () => {
    it("returns correct filtered array", async () => {
      await initAsset(assetA);
      await initAsset(assetB);
      const whitelisted = await oracle.getAllBoundedPricingEnabledAssets();
      expect(whitelisted).to.include(assetA);
      expect(whitelisted).to.include(assetB);
      expect(whitelisted.length).to.equal(2);
    });

    it("returns empty when none whitelisted", async () => {
      const whitelisted = await oracle.getAllBoundedPricingEnabledAssets();
      expect(whitelisted.length).to.equal(0);
    });

    it("filters correctly after partial de-whitelist", async () => {
      // Init 3 assets, de-whitelist middle one
      const vTokenC = await makeVToken(
        { name: "vTokenC", symbol: "vTKC" },
        { name: "TokenC", symbol: "TKC", decimals: 18 },
      );
      const assetC = await vTokenC.underlying();

      await initAsset(assetA);
      await initAsset(assetB);
      await initAsset(assetC);

      await oracle.setAssetBoundedPricingEnabled(assetB, false);

      const whitelisted = await oracle.getAllBoundedPricingEnabledAssets();
      expect(whitelisted.length).to.equal(2);
      expect(whitelisted[0]).to.equal(assetA);
      expect(whitelisted[1]).to.equal(assetC);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 21. checkAndGetWindowDrift
  // ────────────────────────────────────────────────────────────────────────

  describe("checkAndGetWindowDrift", () => {
    beforeEach(async () => {
      await initAssetWithWindow(assetA);
    });

    it("returns true when drift > KEEPER_DEADBAND", async () => {
      // Proposed min 11% below current -> drift > 5%
      const proposedMin = MIN_PRICE.mul(89).div(100);
      const proposedMax = MAX_PRICE.mul(111).div(100);
      const [needsMinUpdate, needsMaxUpdate] = await oracle.checkAndGetWindowDrift(
        [assetA],
        [proposedMin],
        [proposedMax],
      );
      expect(needsMinUpdate[0]).to.equal(true);
      expect(needsMaxUpdate[0]).to.equal(true);
    });

    it("returns false when drift <= KEEPER_DEADBAND", async () => {
      // Proposed within 3% of current
      const proposedMin = MIN_PRICE.mul(97).div(100);
      const proposedMax = MAX_PRICE.mul(103).div(100);
      const [needsMinUpdate, needsMaxUpdate] = await oracle.checkAndGetWindowDrift(
        [assetA],
        [proposedMin],
        [proposedMax],
      );
      expect(needsMinUpdate[0]).to.equal(false);
      expect(needsMaxUpdate[0]).to.equal(false);
    });

    it("returns false when both prices equal (drift = 0)", async () => {
      const [needsMinUpdate, needsMaxUpdate] = await oracle.checkAndGetWindowDrift([assetA], [MIN_PRICE], [MAX_PRICE]);
      expect(needsMinUpdate[0]).to.equal(false);
      expect(needsMaxUpdate[0]).to.equal(false);
    });

    it("returns false when current or proposed price is zero", async () => {
      // Uninitialized asset has minPrice=0, maxPrice=0
      const [needsMinUpdate, needsMaxUpdate] = await oracle.checkAndGetWindowDrift(
        [assetB],
        [parseUnits("1", 18)],
        [parseUnits("1.2", 18)],
      );
      expect(needsMinUpdate[0]).to.equal(false);
      expect(needsMaxUpdate[0]).to.equal(false);
    });

    it("returns false when drift exactly at KEEPER_DEADBAND (strict >)", async () => {
      // drift = |current - proposed| * 1e18 / current = KEEPER_DEADBAND exactly
      // proposed = MIN_PRICE * (1 - 0.05) = 0.9 * 0.95 = 0.855
      const proposedMin = MIN_PRICE.mul(EXP_SCALE.sub(KEEPER_DEADBAND)).div(EXP_SCALE);
      const [needsMinUpdate] = await oracle.checkAndGetWindowDrift([assetA], [proposedMin], [MAX_PRICE]);
      expect(needsMinUpdate[0]).to.equal(false);
    });

    it("returns true when drift at KEEPER_DEADBAND + 1 wei", async () => {
      const proposedMin = MIN_PRICE.mul(EXP_SCALE.sub(KEEPER_DEADBAND)).div(EXP_SCALE).sub(1);
      const [needsMinUpdate] = await oracle.checkAndGetWindowDrift([assetA], [proposedMin], [MAX_PRICE]);
      expect(needsMinUpdate[0]).to.equal(true);
    });

    it("covers both drift directions: proposed above and below on-chain", async () => {
      // Proposed ABOVE on-chain (proposedPrice > currentPrice)
      const proposedMinAbove = MIN_PRICE.mul(106).div(100);
      const [needsMinAbove] = await oracle.checkAndGetWindowDrift([assetA], [proposedMinAbove], [MAX_PRICE]);
      expect(needsMinAbove[0]).to.equal(true);

      // Proposed BELOW on-chain (proposedPrice < currentPrice)
      const proposedMinBelow = MIN_PRICE.mul(94).div(100);
      const [needsMinBelow] = await oracle.checkAndGetWindowDrift([assetA], [proposedMinBelow], [MAX_PRICE]);
      expect(needsMinBelow[0]).to.equal(true);
    });

    it("returns [false, false] for uninitialized asset with non-zero proposed values", async () => {
      const uninitAsset = someone.address; // random address, not initialized
      const [needsMinUpdate, needsMaxUpdate] = await oracle.checkAndGetWindowDrift(
        [uninitAsset],
        [parseUnits("1", 18)],
        [parseUnits("1.2", 18)],
      );
      expect(needsMinUpdate[0]).to.equal(false);
      expect(needsMaxUpdate[0]).to.equal(false);
    });

    it("reverts when array lengths mismatch", async () => {
      await expect(
        oracle.checkAndGetWindowDrift([assetA], [MIN_PRICE, MIN_PRICE], [MAX_PRICE]),
      ).to.be.revertedWithCustomError(oracle, "InvalidArrayLength");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 22. assetProtectionConfig getter
  // ────────────────────────────────────────────────────────────────────────

  describe("assetProtectionConfig getter", () => {
    it("returns all struct fields correctly", async () => {
      await initAsset(assetA);

      const state = await oracle.assetProtectionConfig(assetA);
      expect(state.minPrice).to.equal(SPOT_PRICE);
      expect(state.maxPrice).to.equal(SPOT_PRICE);
      expect(state.currentlyUsingProtectedPrice).to.equal(false);
      expect(state.isBoundedPricingEnabled).to.equal(true);
      expect(state.lastProtectionTriggeredAt).to.equal(0);
      expect(state.cooldownPeriod).to.equal(DEFAULT_COOLDOWN);
      expect(state.asset).to.equal(assetA);
      expect(state.triggerThreshold).to.equal(DEFAULT_THRESHOLD);
      expect(state.resetThreshold).to.equal(DEFAULT_RESET_THRESHOLD);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 23. Volatile price extends protection period
  // ────────────────────────────────────────────────────────────────────────

  describe("volatile price extends protection period", () => {
    it("continued deviation updates lastProtectionTriggeredAt, extending cooldown", async () => {
      await initAssetWithWindow(assetA);

      // 1. Trigger protection
      const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      const state1 = await oracle.assetProtectionConfig(assetA);
      const firstTriggerTime = state1.lastProtectionTriggeredAt;

      // 2. Advance time by half cooldown
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN / 2]);
      await ethers.provider.send("evm_mine", []);

      // 3. Another deviating price → updates lastProtectionTriggeredAt
      const biggerPump = pumpSpot.add(parseUnits("0.2", 18));
      resilientOracle.getPrice.whenCalledWith(assetA).returns(biggerPump);
      const tx = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(tx).to.emit(oracle, "ProtectionTriggered");

      const state2 = await oracle.assetProtectionConfig(assetA);
      expect(state2.lastProtectionTriggeredAt).to.be.gt(firstTriggerTime);

      // 4. Advance time by half cooldown again (total = cooldown from initial trigger,
      //    but only half from the latest update)
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN / 2]);
      await ethers.provider.send("evm_mine", []);

      // 5. Try disable → should revert because cooldown restarted from the second trigger
      const stateBeforeDisable = await oracle.assetProtectionConfig(assetA);
      const range = stateBeforeDisable.maxPrice
        .sub(stateBeforeDisable.minPrice)
        .mul(EXP_SCALE)
        .div(stateBeforeDisable.minPrice);
      const newReset = range.add(parseUnits("0.001", 18));
      const trigger = stateBeforeDisable.triggerThreshold;
      if (newReset.gte(trigger)) {
        await oracle.setThresholds(assetA, newReset.add(parseUnits("0.01", 18)), newReset);
      } else {
        await oracle.setThresholds(assetA, trigger, newReset);
      }

      await expect(oracle.exitProtectionMode(assetA)).to.be.revertedWithCustomError(oracle, "CooldownNotElapsed");

      // 6. Advance remaining half cooldown
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN / 2 + 1]);
      await ethers.provider.send("evm_mine", []);

      // 7. Now disable succeeds
      await expect(oracle.exitProtectionMode(assetA)).to.not.be.reverted;
    });

    it("protection period does NOT extend when price returns within threshold", async () => {
      await initAssetWithWindow(assetA);

      // Trigger protection
      const pumpSpot2 = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(pumpSpot2);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      const state1 = await oracle.assetProtectionConfig(assetA);
      const triggerTime = state1.lastProtectionTriggeredAt;

      // Set price back within threshold
      resilientOracle.getPrice.whenCalledWith(assetA).returns(SPOT_PRICE);
      const tx = await oracle.getBoundedCollateralPrice(vTokenA.address);

      // Should NOT emit ProtectionTriggered, timestamp unchanged
      await expect(tx).to.not.emit(oracle, "ProtectionTriggered");
      const state2 = await oracle.assetProtectionConfig(assetA);
      expect(state2.lastProtectionTriggeredAt).to.equal(triggerTime);

      // Protection still active (time-gated)
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // M01: cooldown reset only on first trigger or genuine window expansion
  // ────────────────────────────────────────────────────────────────────────

  describe("Cooldown reset only on genuine window expansion", () => {
    it("recovery after a crash does NOT reset the cooldown", async () => {
      await initAssetWithWindow(assetA);

      // Crash: spot below maxPrice * (1 - threshold) = 1.1 * 0.8 = 0.88
      const crashSpot = parseUnits("0.6", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(crashSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      const stateAfterCrash = await oracle.assetProtectionConfig(assetA);
      const t0 = stateAfterCrash.lastProtectionTriggeredAt;
      expect(stateAfterCrash.minPrice).to.equal(crashSpot);
      expect(stateAfterCrash.currentlyUsingProtectedPrice).to.equal(true);

      // Advance halfway through cooldown
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN / 2]);
      await ethers.provider.send("evm_mine", []);

      // Recovery: spot above minPrice * (1 + threshold) = 0.6 * 1.2 = 0.72,
      // still within the existing window (no new low, no new high → windowExpanded = false).
      // _exceedsDeviationThreshold returns true (recovery is misclassified as a pump),
      // but the cooldown must NOT advance.
      const recoverySpot = parseUnits("0.85", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(recoverySpot);
      const tx = await oracle.getBoundedCollateralPrice(vTokenA.address);
      await expect(tx).to.emit(oracle, "ProtectionTriggered");

      const stateAfterRecovery = await oracle.assetProtectionConfig(assetA);
      expect(stateAfterRecovery.lastProtectionTriggeredAt).to.equal(t0);
      expect(stateAfterRecovery.minPrice).to.equal(crashSpot);
      expect(stateAfterRecovery.maxPrice).to.equal(MAX_PRICE);
    });

    it("a deeper crash (new low) DOES reset the cooldown", async () => {
      await initAssetWithWindow(assetA);

      const firstCrash = parseUnits("0.6", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(firstCrash);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      const t0 = (await oracle.assetProtectionConfig(assetA)).lastProtectionTriggeredAt;

      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN / 2]);
      await ethers.provider.send("evm_mine", []);

      // New low: minPrice expands → windowExpanded = true → cooldown resets
      const deeperCrash = parseUnits("0.5", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(deeperCrash);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      const stateAfter = await oracle.assetProtectionConfig(assetA);
      expect(stateAfter.lastProtectionTriggeredAt).to.be.gt(t0);
      expect(stateAfter.minPrice).to.equal(deeperCrash);
    });

    it("sustained pump within the existing window does NOT reset the cooldown", async () => {
      await initAssetWithWindow(assetA);

      // Pump above maxPrice so the window expands on the first trigger
      const firstPump = parseUnits("1.4", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(firstPump);
      await oracle.getBoundedCollateralPrice(vTokenA.address);
      const stateAfterFirstPump = await oracle.assetProtectionConfig(assetA);
      const t0 = stateAfterFirstPump.lastProtectionTriggeredAt;
      expect(stateAfterFirstPump.maxPrice).to.equal(firstPump);

      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN / 2]);
      await ethers.provider.send("evm_mine", []);

      // Still pump-classified (1.3 > 0.9 * 1.2 = 1.08) but no new high (1.3 < 1.4)
      const sustainedPump = parseUnits("1.3", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(sustainedPump);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      const stateAfter = await oracle.assetProtectionConfig(assetA);
      expect(stateAfter.lastProtectionTriggeredAt).to.equal(t0);
      expect(stateAfter.maxPrice).to.equal(firstPump);
    });

    it("exitProtectionMode becomes reachable when recovery does not refresh the cooldown", async () => {
      await initAssetWithWindow(assetA);

      // Mild crash: spot < 1.1 * 0.8 = 0.88, with the resulting window narrow enough
      // (~29%) to fit under MAX_THRESHOLD = 50% when we later bump setThresholds.
      const crashSpot = parseUnits("0.85", 18);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(crashSpot);
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      // Recovery within the existing window but above the post-crash pump threshold
      // (1.05 > 0.85 * 1.2 = 1.02). _exceedsDeviationThreshold returns true,
      // but no new low / no new high → windowExpanded = false → cooldown must NOT advance.
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN / 2]);
      await ethers.provider.send("evm_mine", []);
      resilientOracle.getPrice.whenCalledWith(assetA).returns(parseUnits("1.05", 18));
      await oracle.getBoundedCollateralPrice(vTokenA.address);

      // Finish the original cooldown window
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN / 2 + 1]);
      await ethers.provider.send("evm_mine", []);

      // Bump resetThreshold above the current range (~29.4%) so the convergence check passes
      const stateBeforeExit = await oracle.assetProtectionConfig(assetA);
      const range = stateBeforeExit.maxPrice.sub(stateBeforeExit.minPrice).mul(EXP_SCALE).div(stateBeforeExit.minPrice);
      const newReset = range.add(parseUnits("0.001", 18));
      const newTrigger = newReset.add(parseUnits("0.01", 18));
      await oracle.setThresholds(assetA, newTrigger, newReset);

      await expect(oracle.exitProtectionMode(assetA)).to.not.be.reverted;
      expect(await oracle.currentlyUsingProtectedPrice(assetA)).to.equal(false);
    });
  });
});
