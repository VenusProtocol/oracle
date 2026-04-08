import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai from "chai";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

import { ADDRESSES } from "../../helpers/deploymentConfig";
import {
  DeviationBoundedOracle,
  DeviationBoundedOracleCaller,
  IAccessControlManagerV8,
  MockSimpleOracle,
  VBep20Interface,
} from "../../typechain-types";
import { addr0000 } from "../utils/data";
import { forking, initMainnetUser } from "./utils";

const { expect } = chai;

const FORK: boolean = process.env.FORK === "true";
const FORKED_NETWORK: string = process.env.FORKED_NETWORK || "";

const EXP_SCALE = parseUnits("1", 18);
const MIN_THRESHOLD = parseUnits("0.05", 18);
const MAX_THRESHOLD = parseUnits("0.5", 18);
const KEEPER_DEADBAND = parseUnits("0.05", 18);
const DEFAULT_THRESHOLD = parseUnits("0.2", 18);
const DEFAULT_RESET_THRESHOLD = parseUnits("0.1", 18);
const DEFAULT_COOLDOWN = 3600;
const SPOT_PRICE = parseUnits("1", 18);
const MIN_PRICE = parseUnits("0.9", 18);
const MAX_PRICE = parseUnits("1.1", 18);
const NATIVE_TOKEN_ADDR = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";

// Real BSC mainnet vToken addresses
const VETH_ADDRESS = "0xf508fCD89b8bd15579dc79A6827cB4686A3592c8";
const VBTC_ADDRESS = "0x882C173bC7Ff3b7786CA16dfeD3DFFfb9Ee7847B";

if (FORK && FORKED_NETWORK === "bscmainnet") {
  const {
    acm: ACM_ADDRESS,
    timelock: TIMELOCK_ADDRESS,
    vBNBAddress: VBNB_ADDRESS,
    VAIAddress: VAI_ADDRESS,
  } = ADDRESSES[FORKED_NETWORK];

  forking(90924377, () => {
    let admin: SignerWithAddress;
    let someone: SignerWithAddress;
    let timelockSigner: SignerWithAddress;
    let mockOracle: MockSimpleOracle;
    let acm: IAccessControlManagerV8;
    let oracle: DeviationBoundedOracle;
    let caller: DeviationBoundedOracleCaller;
    let vTokenA: VBep20Interface; // vETH
    let vTokenB: VBep20Interface; // vBTC
    let assetA: string; // WETH underlying
    let assetB: string; // BTCB underlying

    const fixture = async () => {
      const [deployer, other] = await ethers.getSigners();

      // Impersonate the real BSC mainnet timelock
      const impersonatedTimelock = await initMainnetUser(TIMELOCK_ADDRESS, parseUnits("100"));

      // Get real on-chain ACM
      const acmContract = <IAccessControlManagerV8>(
        await ethers.getContractAt("IAccessControlManagerV8", ACM_ADDRESS, impersonatedTimelock)
      );

      // Get real on-chain vTokens
      const vETH = <VBep20Interface>await ethers.getContractAt("VBep20Interface", VETH_ADDRESS);
      const vBTC = <VBep20Interface>await ethers.getContractAt("VBep20Interface", VBTC_ADDRESS);
      const underlyingA = await vETH.underlying();
      const underlyingB = await vBTC.underlying();

      // Deploy MockSimpleOracle (fresh — replaces ResilientOracle for price control)
      const MockOracleFactory = await ethers.getContractFactory("MockSimpleOracle");
      const mockOracleDeployed = <MockSimpleOracle>await MockOracleFactory.deploy();

      // Set default prices for all test assets
      await mockOracleDeployed.setPrice(underlyingA, SPOT_PRICE);
      await mockOracleDeployed.setPrice(underlyingB, SPOT_PRICE);
      await mockOracleDeployed.setPrice(NATIVE_TOKEN_ADDR, SPOT_PRICE);
      await mockOracleDeployed.setPrice(VAI_ADDRESS, SPOT_PRICE);

      // Deploy DeviationBoundedOracle as upgradeable proxy
      const OracleFactory = await ethers.getContractFactory("DeviationBoundedOracle", deployer);
      const oracleDeployed = <DeviationBoundedOracle>await upgrades.deployProxy(OracleFactory, [acmContract.address], {
        constructorArgs: [mockOracleDeployed.address, VBNB_ADDRESS, VAI_ADDRESS],
      });

      // Impersonated timelock grants all DBO permissions to deployer via real ACM
      const DBO_FUNCTIONS = [
        "setTokenConfig(address,uint64,uint256,uint256)",
        "setCooldownPeriod(address,uint64)",
        "setThresholds(address,uint256,uint256)",
        "setAssetBoundedPricingEnabled(address,bool)",
        "updateMinPrice(address,uint128)",
        "updateMaxPrice(address,uint128)",
        "disableActiveProtection(address)",
      ];
      for (const fn of DBO_FUNCTIONS) {
        await acmContract.giveCallPermission(oracleDeployed.address, fn, deployer.address);
      }

      // Deploy caller as normal contract
      const CallerFactory = await ethers.getContractFactory("DeviationBoundedOracleCaller", deployer);
      const callerDeployed = <DeviationBoundedOracleCaller>await CallerFactory.deploy(oracleDeployed.address);

      return {
        mockOracle: mockOracleDeployed,
        acm: acmContract,
        oracle: oracleDeployed,
        caller: callerDeployed,
        admin: deployer,
        someone: other,
        timelockSigner: impersonatedTimelock,
        vTokenA: vETH,
        vTokenB: vBTC,
        assetA: underlyingA,
        assetB: underlyingB,
      };
    };

    beforeEach(async () => {
      ({ mockOracle, acm, oracle, caller, admin, someone, timelockSigner, vTokenA, vTokenB, assetA, assetB } =
        await loadFixture(fixture));
    });

    // ── Helpers ───────────────────────────────────────────────────────────

    const initAsset = async (
      asset: string,
      cooldown: number = DEFAULT_COOLDOWN,
      triggerThreshold: BigNumber = DEFAULT_THRESHOLD,
      resetThreshold: BigNumber = DEFAULT_RESET_THRESHOLD,
    ) => {
      await oracle.setTokenConfig(asset, cooldown, triggerThreshold, resetThreshold);
    };

    const initAssetWithWindow = async (
      asset: string,
      minPrice: BigNumber = MIN_PRICE,
      maxPrice: BigNumber = MAX_PRICE,
      cooldown: number = DEFAULT_COOLDOWN,
      triggerThreshold: BigNumber = DEFAULT_THRESHOLD,
      resetThreshold: BigNumber = DEFAULT_RESET_THRESHOLD,
    ) => {
      await oracle.setTokenConfig(asset, cooldown, triggerThreshold, resetThreshold);
      await oracle.updateMinPrice(asset, minPrice);
      await oracle.updateMaxPrice(asset, maxPrice);
    };

    const triggerPump = async (
      asset: string,
      vToken: VBep20Interface,
      minPrice: BigNumber = MIN_PRICE,
      threshold: BigNumber = DEFAULT_THRESHOLD,
    ): Promise<BigNumber> => {
      const pumpSpot = minPrice.mul(EXP_SCALE.add(threshold)).div(EXP_SCALE).add(1);
      await mockOracle.setPrice(asset, pumpSpot);
      await oracle.getBoundedCollateralPrice(vToken.address);
      return pumpSpot;
    };

    const disableProtection = async (asset: string) => {
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);

      const state = await oracle.assetProtectionConfig(asset);
      const rangeRatio = state.maxPrice.sub(state.minPrice).mul(EXP_SCALE).div(state.minPrice);
      const newReset = rangeRatio.add(1);
      const newTrigger = newReset.add(parseUnits("0.01", 18));

      await oracle.setThresholds(asset, newTrigger, newReset);
      await oracle.disableActiveProtection(asset);
    };

    // ────────────────────────────────────────────────────────────────────
    // 1. Constructor
    // ────────────────────────────────────────────────────────────────────

    describe("1. constructor", () => {
      it("1.1 sets immutables correctly", async () => {
        expect(await oracle.RESILIENT_ORACLE()).to.equal(mockOracle.address);
        expect(await oracle.nativeMarket()).to.equal(VBNB_ADDRESS);
        expect(await oracle.vai()).to.equal(VAI_ADDRESS);
      });

      it("1.2 reverts when _resilientOracle is zero address", async () => {
        const Factory = await ethers.getContractFactory("DeviationBoundedOracle");
        await expect(
          upgrades.deployProxy(Factory, [acm.address], {
            constructorArgs: [addr0000, VBNB_ADDRESS, VAI_ADDRESS],
          }),
        ).to.be.revertedWithCustomError(oracle, "ZeroAddressNotAllowed");
      });

      it("1.3 reverts when nativeMarketAddress is zero address", async () => {
        const Factory = await ethers.getContractFactory("DeviationBoundedOracle");
        await expect(
          upgrades.deployProxy(Factory, [acm.address], {
            constructorArgs: [mockOracle.address, addr0000, VAI_ADDRESS],
          }),
        ).to.be.revertedWithCustomError(oracle, "ZeroAddressNotAllowed");
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 2. Initialize
    // ────────────────────────────────────────────────────────────────────

    describe("2. initialize", () => {
      it("2.1 sets access control manager", async () => {
        expect(ethers.utils.getAddress(await oracle.accessControlManager())).to.equal(
          ethers.utils.getAddress(acm.address),
        );
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 3. setTokenConfig
    // ────────────────────────────────────────────────────────────────────

    describe("3. setTokenConfig", () => {
      describe("happy path", () => {
        it("3.1 sets all struct fields, emits events, updates asset lists", async () => {
          const tx = await oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD);

          const state = await oracle.assetProtectionConfig(assetA);
          expect(state.minPrice).to.equal(SPOT_PRICE);
          expect(state.maxPrice).to.equal(SPOT_PRICE);
          expect(state.isProtectedPriceActive).to.equal(false);
          expect(state.isBoundedPricingEnabled).to.equal(true);
          expect(state.lastProtectionTriggeredAt).to.equal(0);
          expect(state.cooldownPeriod).to.equal(DEFAULT_COOLDOWN);
          expect(state.asset).to.equal(assetA);
          expect(state.triggerThreshold).to.equal(DEFAULT_THRESHOLD);
          expect(state.resetThreshold).to.equal(DEFAULT_RESET_THRESHOLD);

          await expect(tx)
            .to.emit(oracle, "ProtectionInitialized")
            .withArgs(assetA, SPOT_PRICE, SPOT_PRICE, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD);
          await expect(tx).to.emit(oracle, "BoundedPricingWhitelistUpdated").withArgs(assetA, true);

          expect(await oracle.getInitializedAssets()).to.include(assetA);
          expect(await oracle.getAllBoundedPricingEnabledAssets()).to.include(assetA);
        });
      });

      describe("revert branches", () => {
        it("3.2 reverts when caller is unauthorized", async () => {
          await expect(
            oracle
              .connect(someone)
              .setTokenConfig(assetA, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD),
          ).to.be.revertedWithCustomError(oracle, "Unauthorized");
        });

        it("3.3 reverts when asset is zero address", async () => {
          await expect(
            oracle.setTokenConfig(addr0000, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD),
          ).to.be.revertedWithCustomError(oracle, "ZeroAddressNotAllowed");
        });

        it("3.4 reverts when already initialized", async () => {
          await initAsset(assetA);
          await expect(
            oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD),
          ).to.be.revertedWithCustomError(oracle, "MarketAlreadyInitialized");
        });

        it("3.5 reverts when threshold < MIN_THRESHOLD", async () => {
          await expect(
            oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, MIN_THRESHOLD.sub(1), DEFAULT_RESET_THRESHOLD),
          ).to.be.revertedWithCustomError(oracle, "ThresholdBelowMinimum");
        });

        it("3.6 reverts when threshold > MAX_THRESHOLD", async () => {
          await expect(
            oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, MAX_THRESHOLD.add(1), DEFAULT_RESET_THRESHOLD),
          ).to.be.revertedWithCustomError(oracle, "ThresholdAboveMaximum");
        });

        it("3.7 reverts when resetThreshold >= triggerThreshold", async () => {
          await expect(
            oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, DEFAULT_THRESHOLD),
          ).to.be.revertedWithCustomError(oracle, "InvalidResetThreshold");
        });

        it("3.8 reverts when asset is VAI", async () => {
          await expect(
            oracle.setTokenConfig(VAI_ADDRESS, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD),
          ).to.be.revertedWithCustomError(oracle, "VAINotAllowed");
        });

        it("3.9 reverts when cooldownPeriod is zero", async () => {
          await expect(
            oracle.setTokenConfig(assetA, 0, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD),
          ).to.be.revertedWithCustomError(oracle, "ZeroValueNotAllowed");
        });

        it("3.10 reverts when triggerThreshold is zero", async () => {
          await expect(
            oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, 0, DEFAULT_RESET_THRESHOLD),
          ).to.be.revertedWithCustomError(oracle, "ZeroValueNotAllowed");
        });

        it("3.11 reverts when resetThreshold is zero", async () => {
          await expect(
            oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, 0),
          ).to.be.revertedWithCustomError(oracle, "ZeroValueNotAllowed");
        });

        it("3.12 reverts when re-initializing after de-whitelist", async () => {
          await initAsset(assetA);
          await oracle.setAssetBoundedPricingEnabled(assetA, false);
          await expect(
            oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD),
          ).to.be.revertedWithCustomError(oracle, "MarketAlreadyInitialized");
        });

        it("3.13 reverts with PriceExceedsUint128 when oracle returns > uint128 max", async () => {
          const overflowPrice = BigNumber.from(2).pow(128);
          await mockOracle.setPrice(assetA, overflowPrice);
          await expect(
            oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD),
          ).to.be.revertedWithCustomError(oracle, "PriceExceedsUint128");
        });
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 4. setCooldownPeriod
    // ────────────────────────────────────────────────────────────────────

    describe("4. setCooldownPeriod", () => {
      beforeEach(async () => {
        await initAsset(assetA);
      });

      it("4.1 updates cooldownPeriod and emits event", async () => {
        const tx = await oracle.setCooldownPeriod(assetA, 7200);
        await expect(tx).to.emit(oracle, "CooldownPeriodSet").withArgs(assetA, DEFAULT_COOLDOWN, 7200);
        expect((await oracle.assetProtectionConfig(assetA)).cooldownPeriod).to.equal(7200);
      });

      it("4.2 reverts when caller is unauthorized", async () => {
        await expect(oracle.connect(someone).setCooldownPeriod(assetA, 7200)).to.be.revertedWithCustomError(
          oracle,
          "Unauthorized",
        );
      });

      it("4.3 reverts when asset is zero address", async () => {
        await expect(oracle.setCooldownPeriod(addr0000, 7200)).to.be.revertedWithCustomError(
          oracle,
          "ZeroAddressNotAllowed",
        );
      });

      it("4.4 reverts when not initialized", async () => {
        await expect(oracle.setCooldownPeriod(assetB, 7200)).to.be.revertedWithCustomError(
          oracle,
          "MarketNotInitialized",
        );
      });

      it("4.5 reverts when new cooldown is zero", async () => {
        await expect(oracle.setCooldownPeriod(assetA, 0)).to.be.revertedWithCustomError(oracle, "ZeroValueNotAllowed");
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 5. setThresholds
    // ────────────────────────────────────────────────────────────────────

    describe("5. setThresholds", () => {
      beforeEach(async () => {
        await initAsset(assetA);
      });

      it("5.1 updates both thresholds and emits both events", async () => {
        const newTrigger = parseUnits("0.25", 18);
        const newReset = parseUnits("0.12", 18);
        const tx = await oracle.setThresholds(assetA, newTrigger, newReset);
        await expect(tx).to.emit(oracle, "TriggerThresholdSet").withArgs(assetA, DEFAULT_THRESHOLD, newTrigger);
        await expect(tx).to.emit(oracle, "ResetThresholdSet").withArgs(assetA, DEFAULT_RESET_THRESHOLD, newReset);
      });

      it("5.2 only emits TriggerThresholdSet when only trigger changes", async () => {
        const tx = await oracle.setThresholds(assetA, parseUnits("0.25", 18), DEFAULT_RESET_THRESHOLD);
        await expect(tx).to.emit(oracle, "TriggerThresholdSet");
        await expect(tx).to.not.emit(oracle, "ResetThresholdSet");
      });

      it("5.3 only emits ResetThresholdSet when only reset changes", async () => {
        const tx = await oracle.setThresholds(assetA, DEFAULT_THRESHOLD, parseUnits("0.08", 18));
        await expect(tx).to.not.emit(oracle, "TriggerThresholdSet");
        await expect(tx).to.emit(oracle, "ResetThresholdSet");
      });

      it("5.4 emits no events when neither changes", async () => {
        const tx = await oracle.setThresholds(assetA, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD);
        await expect(tx).to.not.emit(oracle, "TriggerThresholdSet");
        await expect(tx).to.not.emit(oracle, "ResetThresholdSet");
      });

      it("5.5 reverts when caller is unauthorized", async () => {
        await expect(
          oracle.connect(someone).setThresholds(assetA, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD),
        ).to.be.revertedWithCustomError(oracle, "Unauthorized");
      });

      it("5.6 reverts when not initialized", async () => {
        await expect(
          oracle.setThresholds(assetB, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD),
        ).to.be.revertedWithCustomError(oracle, "MarketNotInitialized");
      });

      it("5.7 reverts when trigger below MIN_THRESHOLD", async () => {
        await expect(
          oracle.setThresholds(assetA, MIN_THRESHOLD.sub(1), DEFAULT_RESET_THRESHOLD),
        ).to.be.revertedWithCustomError(oracle, "ThresholdBelowMinimum");
      });

      it("5.8 reverts when trigger above MAX_THRESHOLD", async () => {
        await expect(
          oracle.setThresholds(assetA, MAX_THRESHOLD.add(1), DEFAULT_RESET_THRESHOLD),
        ).to.be.revertedWithCustomError(oracle, "ThresholdAboveMaximum");
      });

      it("5.9 reverts when reset >= trigger", async () => {
        await expect(oracle.setThresholds(assetA, DEFAULT_THRESHOLD, DEFAULT_THRESHOLD)).to.be.revertedWithCustomError(
          oracle,
          "InvalidResetThreshold",
        );
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 6. setAssetBoundedPricingEnabled
    // ────────────────────────────────────────────────────────────────────

    describe("6. setAssetBoundedPricingEnabled", () => {
      beforeEach(async () => {
        await initAsset(assetA);
      });

      it("6.1 disables bounded pricing and emits event", async () => {
        const tx = await oracle.setAssetBoundedPricingEnabled(assetA, false);
        await expect(tx).to.emit(oracle, "BoundedPricingWhitelistUpdated").withArgs(assetA, false);
        expect(await oracle.isBoundedPricingEnabled(assetA)).to.equal(false);
      });

      it("6.2 enables bounded pricing and emits event", async () => {
        await oracle.setAssetBoundedPricingEnabled(assetA, false);
        const tx = await oracle.setAssetBoundedPricingEnabled(assetA, true);
        await expect(tx).to.emit(oracle, "BoundedPricingWhitelistUpdated").withArgs(assetA, true);
        expect(await oracle.isBoundedPricingEnabled(assetA)).to.equal(true);
      });

      it("6.3 reverts when caller is unauthorized", async () => {
        await expect(
          oracle.connect(someone).setAssetBoundedPricingEnabled(assetA, false),
        ).to.be.revertedWithCustomError(oracle, "Unauthorized");
      });

      it("6.4 reverts when not initialized", async () => {
        await expect(oracle.setAssetBoundedPricingEnabled(assetB, true)).to.be.revertedWithCustomError(
          oracle,
          "MarketNotInitialized",
        );
      });

      it("6.5 reverts when disabling with active protection", async () => {
        await initAssetWithWindow(assetB);
        const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
        await mockOracle.setPrice(assetB, pumpSpot);
        await oracle.getBoundedCollateralPrice(vTokenB.address);

        await expect(oracle.setAssetBoundedPricingEnabled(assetB, false)).to.be.revertedWithCustomError(
          oracle,
          "ProtectedPriceActive",
        );
      });

      it("6.6 price functions return spot after disabling", async () => {
        await initAssetWithWindow(assetB);
        const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
        await mockOracle.setPrice(assetB, pumpSpot);

        expect(await oracle.getBoundedCollateralPriceView(vTokenB.address)).to.equal(MIN_PRICE);
        await oracle.setAssetBoundedPricingEnabled(assetB, false);
        expect(await oracle.getBoundedCollateralPriceView(vTokenB.address)).to.equal(pumpSpot);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 7. updateMinPrice
    // ────────────────────────────────────────────────────────────────────

    describe("7. updateMinPrice", () => {
      beforeEach(async () => {
        await initAssetWithWindow(assetA);
      });

      it("7.1 updates minPrice and emits event", async () => {
        const newMin = parseUnits("0.85", 18);
        const tx = await oracle.updateMinPrice(assetA, newMin);
        await expect(tx).to.emit(oracle, "MinPriceUpdated").withArgs(assetA, MIN_PRICE, newMin);
      });

      it("7.2 reverts when caller is unauthorized", async () => {
        await expect(
          oracle.connect(someone).updateMinPrice(assetA, parseUnits("0.85", 18)),
        ).to.be.revertedWithCustomError(oracle, "Unauthorized");
      });

      it("7.3 reverts when newMin > currentSpot", async () => {
        await expect(oracle.updateMinPrice(assetA, SPOT_PRICE.add(1))).to.be.revertedWithCustomError(
          oracle,
          "InvalidMinPrice",
        );
      });

      it("7.4 reverts when newMin >= maxPrice", async () => {
        await expect(oracle.updateMinPrice(assetA, MAX_PRICE)).to.be.revertedWithCustomError(oracle, "InvalidMinPrice");
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 8. updateMaxPrice
    // ────────────────────────────────────────────────────────────────────

    describe("8. updateMaxPrice", () => {
      beforeEach(async () => {
        await initAssetWithWindow(assetA);
      });

      it("8.1 updates maxPrice and emits event", async () => {
        const tx = await oracle.updateMaxPrice(assetA, parseUnits("1.15", 18));
        await expect(tx).to.emit(oracle, "MaxPriceUpdated").withArgs(assetA, MAX_PRICE, parseUnits("1.15", 18));
      });

      it("8.2 reverts when caller is unauthorized", async () => {
        await expect(
          oracle.connect(someone).updateMaxPrice(assetA, parseUnits("1.15", 18)),
        ).to.be.revertedWithCustomError(oracle, "Unauthorized");
      });

      it("8.3 reverts when newMax < currentSpot", async () => {
        await expect(oracle.updateMaxPrice(assetA, SPOT_PRICE.sub(1))).to.be.revertedWithCustomError(
          oracle,
          "InvalidMaxPrice",
        );
      });

      it("8.4 reverts when newMax <= minPrice", async () => {
        await expect(oracle.updateMaxPrice(assetA, MIN_PRICE)).to.be.revertedWithCustomError(oracle, "InvalidMaxPrice");
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 9. disableActiveProtection
    // ────────────────────────────────────────────────────────────────────

    describe("9. disableActiveProtection", () => {
      it("9.1 disables protection after governance raises reset threshold", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);

        await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
        await ethers.provider.send("evm_mine", []);

        const state = await oracle.assetProtectionConfig(assetA);
        const range = state.maxPrice.sub(state.minPrice).mul(EXP_SCALE).div(state.minPrice);
        const newReset = range.add(parseUnits("0.001", 18));
        const trigger = state.triggerThreshold;
        if (newReset.gte(trigger)) {
          await oracle.setThresholds(assetA, newReset.add(parseUnits("0.01", 18)), newReset);
        } else {
          await oracle.setThresholds(assetA, trigger, newReset);
        }

        const tx = await oracle.disableActiveProtection(assetA);
        await expect(tx).to.emit(oracle, "ProtectedPriceDisabled").withArgs(assetA);
        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(false);
      });

      it("9.2 prices revert to spot after disable", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(MIN_PRICE);

        await disableProtection(assetA);
        await mockOracle.setPrice(assetA, SPOT_PRICE);

        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(SPOT_PRICE);
        expect(await oracle.callStatic.getBoundedDebtPrice(vTokenA.address)).to.equal(SPOT_PRICE);
      });

      it("9.3 reverts when caller is unauthorized", async () => {
        await initAsset(assetA);
        await expect(oracle.connect(someone).disableActiveProtection(assetA)).to.be.revertedWithCustomError(
          oracle,
          "Unauthorized",
        );
      });

      it("9.4 reverts when protection is not active", async () => {
        await initAsset(assetA);
        await expect(oracle.disableActiveProtection(assetA)).to.be.revertedWithCustomError(
          oracle,
          "ProtectedPriceInactive",
        );
      });

      it("9.5 reverts when cooldown has not elapsed", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
        await expect(oracle.disableActiveProtection(assetA)).to.be.revertedWithCustomError(
          oracle,
          "CooldownNotElapsed",
        );
      });

      it("9.6 reverts when range not converged", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
        await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
        await ethers.provider.send("evm_mine", []);
        await expect(oracle.disableActiveProtection(assetA)).to.be.revertedWithCustomError(
          oracle,
          "PriceRangeNotConverged",
        );
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 10. getBoundedCollateralPrice
    // ────────────────────────────────────────────────────────────────────

    describe("10. getBoundedCollateralPrice", () => {
      it("10.1 returns spot when not whitelisted", async () => {
        await initAsset(assetA);
        await oracle.setAssetBoundedPricingEnabled(assetA, false);
        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(SPOT_PRICE);
      });

      it("10.2 returns spot when whitelisted, no deviation", async () => {
        await initAssetWithWindow(assetA);
        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(SPOT_PRICE);
      });

      it("10.3 expands window when spot < minPrice", async () => {
        await initAssetWithWindow(assetA);
        const lowSpot = MIN_PRICE.sub(1);
        await mockOracle.setPrice(assetA, lowSpot);
        await expect(oracle.getBoundedCollateralPrice(vTokenA.address))
          .to.emit(oracle, "MinPriceUpdated")
          .withArgs(assetA, MIN_PRICE, lowSpot);
      });

      it("10.4 expands window when spot > maxPrice", async () => {
        await initAssetWithWindow(assetA);
        await mockOracle.setPrice(assetA, MAX_PRICE.add(1));
        await expect(oracle.getBoundedCollateralPrice(vTokenA.address))
          .to.emit(oracle, "MaxPriceUpdated")
          .withArgs(assetA, MAX_PRICE, MAX_PRICE.add(1));
      });

      it("10.5 triggers protection on pump and returns minPrice", async () => {
        await initAssetWithWindow(assetA);
        const upperBound = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE);
        await mockOracle.setPrice(assetA, upperBound.add(1));

        await expect(oracle.getBoundedCollateralPrice(vTokenA.address)).to.emit(oracle, "ProtectionTriggered");
        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(MIN_PRICE);
      });

      it("10.6 triggers protection on crash and returns spot", async () => {
        const localMin = parseUnits("0.995", 18);
        const localMax = parseUnits("1.005", 18);
        await initAssetWithWindow(assetA, localMin, localMax);

        const lowerBound = localMax.mul(EXP_SCALE.sub(DEFAULT_THRESHOLD)).div(EXP_SCALE);
        const crashSpot = lowerBound.sub(1);
        await mockOracle.setPrice(assetA, crashSpot);

        await expect(oracle.getBoundedCollateralPrice(vTokenA.address)).to.emit(oracle, "ProtectionTriggered");
        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(crashSpot);
      });

      it("10.7 returns spot for uninitialized asset", async () => {
        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(SPOT_PRICE);
        expect(await oracle.getBoundedCollateralPriceView(vTokenA.address)).to.equal(SPOT_PRICE);
      });

      it("10.8 resolves native market to NATIVE_TOKEN_ADDR", async () => {
        await initAssetWithWindow(NATIVE_TOKEN_ADDR);
        expect(await oracle.callStatic.getBoundedCollateralPrice(VBNB_ADDRESS)).to.equal(SPOT_PRICE);
      });

      it("10.9 reverts with PriceExceedsUint128", async () => {
        await initAsset(assetA);
        await mockOracle.setPrice(assetA, BigNumber.from(2).pow(128));
        await expect(oracle.getBoundedCollateralPrice(vTokenA.address)).to.be.revertedWithCustomError(
          oracle,
          "PriceExceedsUint128",
        );
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 11. getBoundedDebtPrice
    // ────────────────────────────────────────────────────────────────────

    describe("11. getBoundedDebtPrice", () => {
      it("11.1 returns spot when no deviation", async () => {
        await initAssetWithWindow(assetA);
        expect(await oracle.callStatic.getBoundedDebtPrice(vTokenA.address)).to.equal(SPOT_PRICE);
      });

      it("11.2 returns maxPrice on crash trigger", async () => {
        await initAssetWithWindow(assetA);
        const lowerBound = MAX_PRICE.mul(EXP_SCALE.sub(DEFAULT_THRESHOLD)).div(EXP_SCALE);
        await mockOracle.setPrice(assetA, lowerBound.sub(1));
        await oracle.getBoundedDebtPrice(vTokenA.address);
        expect(await oracle.callStatic.getBoundedDebtPrice(vTokenA.address)).to.equal(MAX_PRICE);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 12. getBoundedPrices
    // ────────────────────────────────────────────────────────────────────

    describe("12. getBoundedPrices", () => {
      it("12.1 returns (spot, spot) when no deviation", async () => {
        await initAssetWithWindow(assetA);
        const [c, d] = await oracle.callStatic.getBoundedPrices(vTokenA.address);
        expect(c).to.equal(SPOT_PRICE);
        expect(d).to.equal(SPOT_PRICE);
      });

      it("12.2 matches individual functions when protected", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);

        const [c, d] = await oracle.callStatic.getBoundedPrices(vTokenA.address);
        expect(c).to.equal(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address));
        expect(d).to.equal(await oracle.callStatic.getBoundedDebtPrice(vTokenA.address));
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 13. View price functions
    // ────────────────────────────────────────────────────────────────────

    describe("13. view price functions", () => {
      it("13.1 returns spot when no deviation", async () => {
        await initAssetWithWindow(assetA);
        expect(await oracle.getBoundedCollateralPriceView(vTokenA.address)).to.equal(SPOT_PRICE);
        expect(await oracle.getBoundedDebtPriceView(vTokenA.address)).to.equal(SPOT_PRICE);
      });

      it("13.2 simulated trigger without state mutation", async () => {
        await initAssetWithWindow(assetA);
        const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
        await mockOracle.setPrice(assetA, pumpSpot);

        expect(await oracle.getBoundedCollateralPriceView(vTokenA.address)).to.equal(MIN_PRICE);
        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(false);
      });

      it("13.3 view and non-view return identical prices (pump)", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);

        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(
          await oracle.getBoundedCollateralPriceView(vTokenA.address),
        );
        expect(await oracle.callStatic.getBoundedDebtPrice(vTokenA.address)).to.equal(
          await oracle.getBoundedDebtPriceView(vTokenA.address),
        );
      });

      it("13.4 view and non-view return identical prices (crash)", async () => {
        const localMin = parseUnits("0.995", 18);
        const localMax = parseUnits("1.005", 18);
        await initAssetWithWindow(assetA, localMin, localMax);

        const lowerBound = localMax.mul(EXP_SCALE.sub(DEFAULT_THRESHOLD)).div(EXP_SCALE);
        const crashSpot = lowerBound.sub(1);
        await mockOracle.setPrice(assetA, crashSpot);
        await oracle.getBoundedCollateralPrice(vTokenA.address);
        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(true);

        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(
          await oracle.getBoundedCollateralPriceView(vTokenA.address),
        );
        expect(await oracle.callStatic.getBoundedDebtPrice(vTokenA.address)).to.equal(
          await oracle.getBoundedDebtPriceView(vTokenA.address),
        );
      });

      it("13.5 view and non-view return identical prices (no deviation)", async () => {
        await initAssetWithWindow(assetA);

        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(
          await oracle.getBoundedCollateralPriceView(vTokenA.address),
        );
        expect(await oracle.callStatic.getBoundedDebtPrice(vTokenA.address)).to.equal(
          await oracle.getBoundedDebtPriceView(vTokenA.address),
        );
      });

      it("13.6 view and non-view return identical prices (not whitelisted)", async () => {
        await initAsset(assetA);
        await oracle.setAssetBoundedPricingEnabled(assetA, false);

        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(
          await oracle.getBoundedCollateralPriceView(vTokenA.address),
        );
        expect(await oracle.callStatic.getBoundedDebtPrice(vTokenA.address)).to.equal(
          await oracle.getBoundedDebtPriceView(vTokenA.address),
        );
      });

      it("13.7 view and non-view return identical prices (uninitialized asset)", async () => {
        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(
          await oracle.getBoundedCollateralPriceView(vTokenA.address),
        );
        expect(await oracle.callStatic.getBoundedDebtPrice(vTokenA.address)).to.equal(
          await oracle.getBoundedDebtPriceView(vTokenA.address),
        );
      });

      it("13.8 getBoundedPrices matches getBoundedPricesView (protection active)", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
        await mockOracle.setPrice(assetA, SPOT_PRICE);

        const [nonViewC, nonViewD] = await oracle.callStatic.getBoundedPrices(vTokenA.address);
        const [viewC, viewD] = await oracle.getBoundedPricesView(vTokenA.address);
        expect(nonViewC).to.equal(viewC);
        expect(nonViewD).to.equal(viewD);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 14-15. getBoundedPricesView & updateProtectionState
    // ────────────────────────────────────────────────────────────────────

    describe("14. getBoundedPricesView", () => {
      it("14.1 matches individual view functions", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);

        const [c, d] = await oracle.getBoundedPricesView(vTokenA.address);
        expect(c).to.equal(await oracle.getBoundedCollateralPriceView(vTokenA.address));
        expect(d).to.equal(await oracle.getBoundedDebtPriceView(vTokenA.address));
      });
    });

    describe("15. updateProtectionState", () => {
      it("15.1 triggers protection for whitelisted asset", async () => {
        await initAssetWithWindow(assetA);
        const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
        await mockOracle.setPrice(assetA, pumpSpot);

        await expect(oracle.updateProtectionState(vTokenA.address)).to.emit(oracle, "ProtectionTriggered");
        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(true);
      });

      it("15.2 is a no-op for non-whitelisted asset", async () => {
        await initAssetWithWindow(assetA);
        await oracle.setAssetBoundedPricingEnabled(assetA, false);
        await expect(oracle.updateProtectionState(vTokenA.address)).to.not.be.reverted;
        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(false);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 16-18. Simple getters
    // ────────────────────────────────────────────────────────────────────

    describe("16. isBoundedPricingEnabled", () => {
      it("16.1 returns true for enabled, false for disabled/uninitialized", async () => {
        expect(await oracle.isBoundedPricingEnabled(assetA)).to.equal(false);
        await initAsset(assetA);
        expect(await oracle.isBoundedPricingEnabled(assetA)).to.equal(true);
        await oracle.setAssetBoundedPricingEnabled(assetA, false);
        expect(await oracle.isBoundedPricingEnabled(assetA)).to.equal(false);
      });
    });

    describe("17. isProtectedPriceActive", () => {
      it("17.1 returns true when active, false otherwise", async () => {
        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(false);
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(true);
      });
    });

    describe("18. canExitProtection", () => {
      it("18.1 returns false before cooldown, true after cooldown + converged range", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
        expect(await oracle.canExitProtection(assetA)).to.equal(false);

        await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
        await ethers.provider.send("evm_mine", []);
        expect(await oracle.canExitProtection(assetA)).to.equal(false); // range still wide

        const state = await oracle.assetProtectionConfig(assetA);
        const rangeRatio = state.maxPrice.sub(state.minPrice).mul(EXP_SCALE).div(state.minPrice);
        const newReset = rangeRatio.add(parseUnits("0.001", 18));
        if (newReset.gte(state.triggerThreshold)) {
          await oracle.setThresholds(assetA, newReset.add(parseUnits("0.01", 18)), newReset);
        } else {
          await oracle.setThresholds(assetA, state.triggerThreshold, newReset);
        }
        expect(await oracle.canExitProtection(assetA)).to.equal(true);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 19-22. Enumeration, Drift, Config Getter
    // ────────────────────────────────────────────────────────────────────

    describe("19. getInitializedAssets & getAllBoundedPricingEnabledAssets", () => {
      it("19.1 tracks initialized and whitelisted assets", async () => {
        expect(await oracle.getInitializedAssets()).to.have.length(0);
        await initAsset(assetA);
        await initAsset(assetB);
        expect(await oracle.getInitializedAssets()).to.have.length(2);
        expect(await oracle.getAllBoundedPricingEnabledAssets()).to.have.length(2);

        await oracle.setAssetBoundedPricingEnabled(assetB, false);
        expect(await oracle.getInitializedAssets()).to.have.length(2);
        expect(await oracle.getAllBoundedPricingEnabledAssets()).to.have.length(1);
      });
    });

    describe("20. checkAndGetWindowDrift", () => {
      it("20.1 detects drift beyond deadband", async () => {
        await initAssetWithWindow(assetA);
        const [needsMin] = await oracle.checkAndGetWindowDrift([assetA], [MIN_PRICE.mul(89).div(100)], [MAX_PRICE]);
        expect(needsMin[0]).to.equal(true);

        const [noMin] = await oracle.checkAndGetWindowDrift([assetA], [MIN_PRICE], [MAX_PRICE]);
        expect(noMin[0]).to.equal(false);
      });

      it("20.2 reverts when array lengths mismatch", async () => {
        await expect(
          oracle.checkAndGetWindowDrift([assetA], [MIN_PRICE, MIN_PRICE], [MAX_PRICE]),
        ).to.be.revertedWithCustomError(oracle, "InvalidArrayLength");
      });
    });

    describe("21. assetProtectionConfig getter", () => {
      it("21.1 returns all struct fields correctly", async () => {
        await initAsset(assetA);
        const state = await oracle.assetProtectionConfig(assetA);
        expect(state.minPrice).to.equal(SPOT_PRICE);
        expect(state.maxPrice).to.equal(SPOT_PRICE);
        expect(state.isProtectedPriceActive).to.equal(false);
        expect(state.isBoundedPricingEnabled).to.equal(true);
        expect(state.cooldownPeriod).to.equal(DEFAULT_COOLDOWN);
        expect(state.asset).to.equal(assetA);
        expect(state.triggerThreshold).to.equal(DEFAULT_THRESHOLD);
        expect(state.resetThreshold).to.equal(DEFAULT_RESET_THRESHOLD);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 22. Transient Cache
    // ────────────────────────────────────────────────────────────────────

    describe("22. transient cache", () => {
      beforeEach(async () => {
        await initAssetWithWindow(assetA);
      });

      it("22.1 cache hit, no protection -- view returns cached spot", async () => {
        const result = await caller.callStatic.updateAndGetBothPrices(vTokenA.address);
        expect(result.collateral).to.equal(SPOT_PRICE);
        expect(result.debt).to.equal(SPOT_PRICE);
      });

      it("22.2 cache hit, protection active", async () => {
        await triggerPump(assetA, vTokenA);
        const state = await oracle.assetProtectionConfig(assetA);
        const result = await caller.callStatic.updateAndGetBothPrices(vTokenA.address);
        expect(result.collateral).to.equal(MIN_PRICE);
        expect(result.debt).to.equal(state.maxPrice);
      });

      it("22.3 protection triggered + window expanded in same call", async () => {
        const crashSpot = parseUnits("0.7", 18);
        await mockOracle.setPrice(assetA, crashSpot);

        const result = await caller.callStatic.updateAndGetBothPrices(vTokenA.address);
        expect(result.collateral).to.equal(crashSpot);
        expect(result.debt).to.equal(MAX_PRICE);

        await caller.updateAndGetBothPrices(vTokenA.address);
        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(true);
      });

      it("22.4 cache miss -- view fetches fresh", async () => {
        const result = await caller.getViewPricesWithoutUpdate(vTokenA.address);
        expect(result.collateral).to.equal(SPOT_PRICE);
      });

      it("22.5 cache miss, deviation -- simulated trigger", async () => {
        const pumpSpot = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE).add(1);
        await mockOracle.setPrice(assetA, pumpSpot);

        const result = await caller.getViewPricesWithoutUpdate(vTokenA.address);
        expect(result.collateral).to.equal(MIN_PRICE);
        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(false);
      });

      it("22.6 per-asset cache isolation", async () => {
        const specialSpot = parseUnits("2", 18);
        await mockOracle.setPrice(assetB, specialSpot);
        await initAssetWithWindow(assetB, parseUnits("1.95", 18), parseUnits("2.05", 18));

        const collateralA = await caller.callStatic.updateAndGetCollateralPrice(vTokenA.address);
        expect(collateralA).to.equal(SPOT_PRICE);

        const resultB = await caller.getViewPricesWithoutUpdate(vTokenB.address);
        expect(resultB.collateral).to.equal(specialSpot);
      });

      it("22.7 non-whitelisted caches (spot, spot)", async () => {
        await oracle.setAssetBoundedPricingEnabled(assetA, false);
        const specialSpot = parseUnits("1.5", 18);
        await mockOracle.setPrice(assetA, specialSpot);

        const result = await caller.callStatic.updateAndGetBothPrices(vTokenA.address);
        expect(result.collateral).to.equal(specialSpot);
        expect(result.debt).to.equal(specialSpot);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 23. Re-trigger After Disable
    // ────────────────────────────────────────────────────────────────────

    describe("23. re-trigger after disable", () => {
      it("23.1 non-view re-triggers", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
        await disableProtection(assetA);

        await mockOracle.setPrice(assetA, parseUnits("1.2", 18));
        await expect(oracle.getBoundedCollateralPrice(vTokenA.address)).to.emit(oracle, "ProtectionTriggered");
        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(MIN_PRICE);
      });

      it("23.2 view simulates trigger after disable", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
        await disableProtection(assetA);

        await mockOracle.setPrice(assetA, parseUnits("1.2", 18));
        expect(await oracle.getBoundedCollateralPriceView(vTokenA.address)).to.equal(MIN_PRICE);
        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(false);
      });

      it("23.3 lastProtectionTriggeredAt is fresh", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
        const firstTime = (await oracle.assetProtectionConfig(assetA)).lastProtectionTriggeredAt;
        await disableProtection(assetA);

        await mockOracle.setPrice(assetA, parseUnits("1.2", 18));
        await oracle.getBoundedCollateralPrice(vTokenA.address);
        expect((await oracle.assetProtectionConfig(assetA)).lastProtectionTriggeredAt).to.be.gt(firstTime);
      });

      it("23.4 repeated trigger -> disable -> trigger cycle", async () => {
        await initAssetWithWindow(assetA);
        for (let i = 0; i < 3; i++) {
          await triggerPump(assetA, vTokenA);
          await disableProtection(assetA);
          await oracle.setThresholds(assetA, DEFAULT_THRESHOLD, DEFAULT_RESET_THRESHOLD);
        }
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 24. Threshold Effects
    // ────────────────────────────────────────────────────────────────────

    describe("24. threshold effects", () => {
      const spot = parseUnits("1.15", 18);

      it("24.1 lowering threshold triggers protection", async () => {
        await oracle.setTokenConfig(assetA, DEFAULT_COOLDOWN, parseUnits("0.3", 18), parseUnits("0.15", 18));
        await oracle.updateMinPrice(assetA, MIN_PRICE);
        await oracle.updateMaxPrice(assetA, MAX_PRICE);
        await mockOracle.setPrice(assetA, spot);

        await oracle.getBoundedCollateralPrice(vTokenA.address);
        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(false);

        const state = await oracle.assetProtectionConfig(assetA);
        await oracle.setThresholds(assetA, DEFAULT_THRESHOLD, state.resetThreshold);
        await expect(oracle.getBoundedCollateralPrice(vTokenA.address)).to.emit(oracle, "ProtectionTriggered");
      });

      it("24.2 raising threshold prevents protection", async () => {
        await initAssetWithWindow(assetA);
        await mockOracle.setPrice(assetA, spot);
        const state = await oracle.assetProtectionConfig(assetA);
        await oracle.setThresholds(assetA, parseUnits("0.3", 18), state.resetThreshold);

        await oracle.getBoundedCollateralPrice(vTokenA.address);
        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(false);
      });

      it("24.3 view reflects threshold change immediately", async () => {
        await initAssetWithWindow(assetA);
        await mockOracle.setPrice(assetA, spot);

        expect(await oracle.getBoundedCollateralPriceView(vTokenA.address)).to.equal(MIN_PRICE);

        const state = await oracle.assetProtectionConfig(assetA);
        await oracle.setThresholds(assetA, parseUnits("0.3", 18), state.resetThreshold);
        expect(await oracle.getBoundedCollateralPriceView(vTokenA.address)).to.equal(spot);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 25. No Re-trigger When Active
    // ────────────────────────────────────────────────────────────────────

    describe("25. no re-trigger, window expands", () => {
      it("25.1 no re-trigger, timestamp unchanged", async () => {
        await initAssetWithWindow(assetA);
        const pumpSpot = await triggerPump(assetA, vTokenA);
        const triggerTime = (await oracle.assetProtectionConfig(assetA)).lastProtectionTriggeredAt;

        await mockOracle.setPrice(assetA, pumpSpot.add(parseUnits("0.5", 18)));
        const tx = await oracle.getBoundedCollateralPrice(vTokenA.address);
        await expect(tx).to.not.emit(oracle, "ProtectionTriggered");
        expect((await oracle.assetProtectionConfig(assetA)).lastProtectionTriggeredAt).to.equal(triggerTime);
      });

      it("25.2 window expands during protection", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);

        const lowSpot = parseUnits("0.8", 18);
        await mockOracle.setPrice(assetA, lowSpot);
        await expect(oracle.getBoundedCollateralPrice(vTokenA.address))
          .to.emit(oracle, "MinPriceUpdated")
          .withArgs(assetA, MIN_PRICE, lowSpot);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 26. Keeper Updates During Protection
    // ────────────────────────────────────────────────────────────────────

    describe("26. keeper updates during protection", () => {
      it("26.1 keeper updates succeed during active protection", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
        await mockOracle.setPrice(assetA, SPOT_PRICE);

        await expect(oracle.updateMinPrice(assetA, parseUnits("0.85", 18))).to.not.be.reverted;
        await expect(oracle.updateMaxPrice(assetA, parseUnits("1.15", 18))).to.not.be.reverted;
      });

      it("26.2 keeper min update affects bounded collateral", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
        await mockOracle.setPrice(assetA, SPOT_PRICE);

        const newMin = parseUnits("0.85", 18);
        await oracle.updateMinPrice(assetA, newMin);
        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(newMin);
      });

      it("26.3 keeper max update affects bounded debt", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
        const originalMax = (await oracle.assetProtectionConfig(assetA)).maxPrice;
        await mockOracle.setPrice(assetA, SPOT_PRICE);

        const newMax = originalMax.add(parseUnits("0.1", 18));
        await oracle.updateMaxPrice(assetA, newMax);
        expect(await oracle.callStatic.getBoundedDebtPrice(vTokenA.address)).to.equal(newMax);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 27. Collateral vs Debt Divergence
    // ────────────────────────────────────────────────────────────────────

    describe("27. collateral vs debt divergence", () => {
      beforeEach(async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
      });

      it("27.1 spot between min and max", async () => {
        await mockOracle.setPrice(assetA, SPOT_PRICE);
        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(MIN_PRICE);
        expect(await oracle.callStatic.getBoundedDebtPrice(vTokenA.address)).to.equal(
          (await oracle.assetProtectionConfig(assetA)).maxPrice,
        );
      });

      it("27.2 spot below min", async () => {
        const lowSpot = parseUnits("0.8", 18);
        await mockOracle.setPrice(assetA, lowSpot);
        await oracle.getBoundedCollateralPrice(vTokenA.address);

        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(lowSpot);
      });

      it("27.3 spot above max", async () => {
        const state = await oracle.assetProtectionConfig(assetA);
        const highSpot = state.maxPrice.add(parseUnits("0.5", 18));
        await mockOracle.setPrice(assetA, highSpot);
        await oracle.getBoundedCollateralPrice(vTokenA.address);

        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(MIN_PRICE);
        expect(await oracle.callStatic.getBoundedDebtPrice(vTokenA.address)).to.equal(highSpot);
      });

      it("27.4 price normalizes but protection still active -- bounded pricing still applies", async () => {
        await mockOracle.setPrice(assetA, SPOT_PRICE);
        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(true);

        const collateral = await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address);
        const debt = await oracle.callStatic.getBoundedDebtPrice(vTokenA.address);
        const state = await oracle.assetProtectionConfig(assetA);

        // Protection is time-gated, not price-gated
        expect(collateral).to.equal(MIN_PRICE);
        expect(debt).to.equal(state.maxPrice);
        expect(collateral).to.not.equal(SPOT_PRICE);
        expect(debt).to.not.equal(SPOT_PRICE);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 28. Multiple Assets Independence
    // ────────────────────────────────────────────────────────────────────

    describe("28. multiple assets independence", () => {
      it("28.1 trigger on one, other unaffected", async () => {
        await initAssetWithWindow(assetA);
        await initAssetWithWindow(assetB);

        await mockOracle.setPrice(assetA, parseUnits("1.2", 18));
        await oracle.getBoundedCollateralPrice(vTokenA.address);

        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(true);
        expect(await oracle.isProtectedPriceActive(assetB)).to.equal(false);
        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenB.address)).to.equal(SPOT_PRICE);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 29. Whitelist Round-Trip
    // ────────────────────────────────────────────────────────────────────

    describe("29. whitelist round-trip", () => {
      it("29.1 disable returns spot, re-enable resets window to current spot", async () => {
        await initAssetWithWindow(assetA);
        const pumpSpot = parseUnits("1.2", 18);
        await mockOracle.setPrice(assetA, pumpSpot);

        await oracle.setAssetBoundedPricingEnabled(assetA, false);
        expect(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address)).to.equal(pumpSpot);

        // Re-enable resets window to current spot (min=max=pumpSpot), no deviation
        await oracle.setAssetBoundedPricingEnabled(assetA, true);
        expect(await oracle.getBoundedCollateralPriceView(vTokenA.address)).to.equal(pumpSpot);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 30. Sequential Calls in Same Tx
    // ────────────────────────────────────────────────────────────────────

    describe("30. sequential calls in same tx", () => {
      it("30.1 two consecutive non-view calls", async () => {
        await initAssetWithWindow(assetA);
        await mockOracle.setPrice(assetA, parseUnits("1.2", 18));

        const result = await caller.callStatic.twoConsecutiveNonViewCollateral(vTokenA.address);
        expect(result.first).to.equal(MIN_PRICE);
        expect(result.second).to.equal(MIN_PRICE);
      });

      it("30.2 updateProtectionState then non-view reads cache", async () => {
        await initAssetWithWindow(assetA);
        await mockOracle.setPrice(assetA, parseUnits("1.2", 18));
        expect(await caller.callStatic.updateThenNonViewCollateral(vTokenA.address)).to.equal(MIN_PRICE);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 31. Atomic Expansion + Trigger
    // ────────────────────────────────────────────────────────────────────

    describe("31. atomic expansion + trigger", () => {
      it("31.1 spot jumps far above maxPrice", async () => {
        await initAssetWithWindow(assetA);
        const bigPump = parseUnits("2", 18);
        await mockOracle.setPrice(assetA, bigPump);

        const tx = await oracle.getBoundedCollateralPrice(vTokenA.address);
        await expect(tx).to.emit(oracle, "MaxPriceUpdated").withArgs(assetA, MAX_PRICE, bigPump);
        await expect(tx).to.emit(oracle, "ProtectionTriggered");
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 32. Boundary Precision
    // ────────────────────────────────────────────────────────────────────

    describe("32. boundary precision", () => {
      it("32.1 exact boundary does NOT trigger, +1 triggers", async () => {
        await initAssetWithWindow(assetA);
        const upperBound = MIN_PRICE.mul(EXP_SCALE.add(DEFAULT_THRESHOLD)).div(EXP_SCALE);

        await mockOracle.setPrice(assetA, upperBound);
        await oracle.getBoundedCollateralPrice(vTokenA.address);
        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(false);

        await mockOracle.setPrice(assetA, upperBound.add(1));
        await oracle.getBoundedCollateralPrice(vTokenA.address);
        expect(await oracle.isProtectedPriceActive(assetA)).to.equal(true);
      });

      it("32.2 reset threshold strict inequality", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);

        await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN + 1]);
        await ethers.provider.send("evm_mine", []);

        const state = await oracle.assetProtectionConfig(assetA);
        const rangeRatio = state.maxPrice.sub(state.minPrice).mul(EXP_SCALE).div(state.minPrice);
        const trigger = rangeRatio.add(parseUnits("0.01", 18));

        await oracle.setThresholds(assetA, trigger, rangeRatio);
        await expect(oracle.disableActiveProtection(assetA)).to.be.revertedWithCustomError(
          oracle,
          "PriceRangeNotConverged",
        );

        if (rangeRatio.add(1).lt(trigger)) {
          await oracle.setThresholds(assetA, trigger, rangeRatio.add(1));
          await expect(oracle.disableActiveProtection(assetA)).to.not.be.reverted;
        }
      });

      it("32.3 deadband strict inequality", async () => {
        await initAssetWithWindow(assetA);
        const exact = MIN_PRICE.mul(EXP_SCALE.sub(KEEPER_DEADBAND)).div(EXP_SCALE);

        const [noUpdate] = await oracle.checkAndGetWindowDrift([assetA], [exact], [MAX_PRICE]);
        expect(noUpdate[0]).to.equal(false);

        const [yesUpdate] = await oracle.checkAndGetWindowDrift([assetA], [exact.sub(1)], [MAX_PRICE]);
        expect(yesUpdate[0]).to.equal(true);
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // 33. Dual-Price API
    // ────────────────────────────────────────────────────────────────────

    describe("33. dual-price API", () => {
      it("33.1 updateProtectionState -> getBoundedPricesView returns cached", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
        await mockOracle.setPrice(assetA, SPOT_PRICE);

        const result = await caller.callStatic.updateAndGetBothPrices(vTokenA.address);
        const state = await oracle.assetProtectionConfig(assetA);
        expect(result.collateral).to.equal(MIN_PRICE);
        expect(result.debt).to.equal(state.maxPrice);
      });

      it("33.2 getBoundedPrices matches individual functions", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
        await mockOracle.setPrice(assetA, SPOT_PRICE);

        const [c, d] = await oracle.callStatic.getBoundedPrices(vTokenA.address);
        expect(c).to.equal(await oracle.callStatic.getBoundedCollateralPrice(vTokenA.address));
        expect(d).to.equal(await oracle.callStatic.getBoundedDebtPrice(vTokenA.address));
      });

      it("33.3 getBoundedPricesView matches individual views", async () => {
        await initAssetWithWindow(assetA);
        await triggerPump(assetA, vTokenA);
        await mockOracle.setPrice(assetA, SPOT_PRICE);

        const [c, d] = await oracle.getBoundedPricesView(vTokenA.address);
        expect(c).to.equal(await oracle.getBoundedCollateralPriceView(vTokenA.address));
        expect(d).to.equal(await oracle.getBoundedDebtPriceView(vTokenA.address));
      });
    });
  });
}
