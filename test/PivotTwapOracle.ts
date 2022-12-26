import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";

import { BoundValidator } from "../src/types";
import { TwapOracle } from "../src/types/contracts/oracles/TwapOracle";
import { addr0000, addr1111 } from "./utils/data";
import { makePairWithTokens } from "./utils/makePair";
import { makeToken } from "./utils/makeToken";
import { makeVToken } from "./utils/makeVToken";
import { getTime, increaseTime } from "./utils/time";

const EXP_SCALE = BigNumber.from(10).pow(18);
const Q112 = BigNumber.from(2).pow(112);
const RATIO = Q112.div(EXP_SCALE);

// helper functions
async function checkObservations(
  twapOracleContract: TwapOracle,
  token: string,
  time: number,
  acc: BigNumber,
  index: number,
) {
  // check observations
  const newObservation = await twapOracleContract.observations(token, index);
  expect(newObservation.timestamp).to.equal(time);
  expect(newObservation.acc).to.equal(acc);
}

describe("Twap Oracle unit tests", function () {
  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin = signers[0];
    this.signers = signers;
    this.admin = admin;
    const vBnb = await makeVToken(this.admin, { name: "vBNB", symbol: "vBNB" }, { name: "BNB", symbol: "BNB" });

    const TwapOracle = await ethers.getContractFactory("TwapOracle", admin);
    const twapInstance = <TwapOracle>await upgrades.deployProxy(TwapOracle, [await vBnb.underlying()]);
    this.twapOracle = twapInstance;

    const BoundValidator = await ethers.getContractFactory("BoundValidator", admin);
    const boundValidatorInstance = <BoundValidator>await upgrades.deployProxy(BoundValidator, []);
    this.boundValidator = boundValidatorInstance;

    const vToken1 = await makeVToken(
      this.admin,
      { name: "vTOKEN1", symbol: "vTOKEN1" },
      { name: "TOKEN1", symbol: "TOKEN1" },
    );
    const tokenBusd = await makeToken(this.admin, "BUSD", "BUSD", 18);
    const simplePair = await makePairWithTokens(this.admin, await vToken1.underlying(), tokenBusd.address);
    this.simplePair = simplePair;

    // set up bnb based pair for later test
    const token3 = await makeToken(this.admin, "TOKEN3", "TOKEN3", 18);
    const BEP20HarnessFactory = await ethers.getContractFactory("BEP20Harness");
    const tokenWbnb = BEP20HarnessFactory.attach(await this.twapOracle.WBNB());
    const bnbBasedPair = await makePairWithTokens(this.admin, token3.address, tokenWbnb.address);
    this.bnbBasedPair = bnbBasedPair;

    const bnbPair = await makePairWithTokens(this.admin, tokenBusd.address, tokenWbnb.address);
    this.bnbPair = bnbPair;
    this.vBnb = vBnb;
    this.vToken1 = vToken1;
  });

  describe("constructor", function () {
    it("sets address of owner", async function () {
      const owner = await this.twapOracle.owner();
      expect(owner).to.equal(this.admin.address);
    });
  });

  describe("admin check", function () {
    beforeEach(async function () {
      this.vBnb = await makeVToken(this.admin, { name: "vBNB", symbol: "vBNB" }, { name: "BNB", symbol: "BNB" });
    });
    it("only admin can call add token configs", async function () {
      // setTokenConfigs
      const config = {
        asset: await this.vBnb.underlying(),
        baseUnit: 100,
        pancakePool: addr1111,
        isBnbBased: false,
        isReversedPool: false,
        anchorPeriod: 30,
      };
      await expect(this.twapOracle.connect(this.signers[2]).setTokenConfigs([config])).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );

      // setTokenConfig
      await expect(this.twapOracle.connect(this.signers[1]).setTokenConfig(config)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });
    it("only admin can call add validation configs", async function () {
      const config = {
        asset: await this.vBnb.underlying(),
        upperBoundRatio: EXP_SCALE.mul(12).div(10),
        lowerBoundRatio: EXP_SCALE.mul(8).div(10),
      };
      await expect(this.boundValidator.connect(this.signers[2]).setValidateConfigs([config])).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );

      await expect(this.boundValidator.connect(this.signers[1]).setValidateConfig(config)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });
  });

  describe("token config", function () {
    beforeEach(async function () {
      this.vBnb = await makeVToken(this.admin, { name: "vBNB", symbol: "vBNB" }, { name: "BNB", symbol: "BNB" });
    });

    describe("add single token config", function () {
      it("should revert on calling updateTwap without setting token configs", async function () {
        await expect(this.twapOracle.updateTwap(this.vBnb.address)).to.be.revertedWith("asset not exist");
      });

      it("vToken can\"t be zero & pool address can't be zero & anchorPeriod can't be 0", async function () {
        const config = {
          asset: addr0000,
          baseUnit: 0,
          pancakePool: addr0000,
          isBnbBased: false,
          isReversedPool: false,
          anchorPeriod: 0,
        };
        await expect(this.twapOracle.setTokenConfig(config)).to.be.revertedWith("can't be zero address");

        config.asset = this.vBnb.underlying();
        await expect(this.twapOracle.setTokenConfig(config)).to.be.revertedWith("can't be zero address");

        config.pancakePool = this.simplePair.address;
        await expect(this.twapOracle.setTokenConfig(config)).to.be.revertedWith("anchor period must be positive");

        config.anchorPeriod = 100;
        await expect(this.twapOracle.setTokenConfig(config)).to.be.revertedWith("base unit must be positive");
        config.baseUnit = 100;

        // nothing happen
        await this.twapOracle.setTokenConfig(config);
      });

      it("reset token config", async function () {
        const vToken = await makeVToken(
          this.admin,
          { name: "vToken", symbol: "vToken" },
          { name: "TOKEN", symbol: "TOKEN" },
        );

        const config1 = {
          asset: await this.vBnb.underlying(),
          baseUnit: 100,
          pancakePool: this.simplePair.address,
          isBnbBased: true,
          isReversedPool: false,
          anchorPeriod: 10,
        };
        const config2 = {
          asset: await vToken.underlying(),
          baseUnit: 1000,
          pancakePool: this.simplePair.address,
          isBnbBased: false,
          isReversedPool: true,
          anchorPeriod: 100,
        };
        await this.twapOracle.setTokenConfig(config1);
        expect((await this.twapOracle.tokenConfigs(await this.vBnb.underlying())).anchorPeriod).to.equal(10);
        await this.twapOracle.setTokenConfig(config2);
        expect((await this.twapOracle.tokenConfigs(await vToken.underlying())).anchorPeriod).to.equal(100);
      });

      it("token config added successfully & events check", async function () {
        const config = {
          asset: await this.vBnb.underlying(),
          baseUnit: 100,
          pancakePool: this.simplePair.address,
          isBnbBased: false,
          isReversedPool: false,
          anchorPeriod: 888,
        };
        const result = await this.twapOracle.setTokenConfig(config);
        await expect(result)
          .to.emit(this.twapOracle, "TokenConfigAdded")
          .withArgs(await this.vBnb.underlying(), this.simplePair.address, 888);

        // starting accumulative price
        const ts = await getTime();
        const acc = Q112.mul(ts);
        await checkObservations(this.twapOracle, await this.vBnb.underlying(), ts, acc, 0);
      });
    });

    describe("batch add token configs", function () {
      it("length check", async function () {
        await expect(this.twapOracle.setTokenConfigs([])).to.be.revertedWith("length can't be 0");
      });

      it("token config added successfully & data check", async function () {
        const config = {
          asset: await this.vBnb.underlying(),
          baseUnit: 100,
          pancakePool: this.simplePair.address,
          isBnbBased: false,
          isReversedPool: false,
          anchorPeriod: 888,
        };
        await this.twapOracle.setTokenConfigs([config]);
        const savedConfig = await this.twapOracle.tokenConfigs(await this.vBnb.underlying());
        expect(savedConfig.anchorPeriod).to.equal(888);
        expect(savedConfig.asset).to.equal(await this.vBnb.underlying());
        expect(savedConfig.pancakePool).to.equal(this.simplePair.address);
        expect(savedConfig.baseUnit).to.equal(100);
      });
    });
  });

  describe("update twap", function () {
    beforeEach(async function () {
      const token0 = await makeVToken(
        this.admin,
        { name: "vETH", symbol: "vETH" },
        { name: "Ethereum", symbol: "ETH" },
      );
      const token1 = await makeVToken(
        this.admin,
        { name: "vMATIC", symbol: "vMATIC" },
        { name: "Matic", symbol: "MATIC" },
      );

      this.tokenConfig = {
        asset: await token0.underlying(),
        baseUnit: EXP_SCALE,
        pancakePool: this.simplePair.address,
        isBnbBased: false,
        isReversedPool: false,
        anchorPeriod: 900, // 15min
      };
      this.token0 = token0;
      this.token1 = token1;
      await this.twapOracle.setTokenConfig(this.tokenConfig);
    });
    it("revert if get underlying price of not existing token", async function () {
      await expect(this.twapOracle.getUnderlyingPrice(this.token1.address)).to.be.revertedWith("asset not exist");
    });
    it("revert if get underlying price of token has not been updated", async function () {
      await expect(this.twapOracle.getUnderlyingPrice(this.token0.address)).to.be.revertedWith(
        "TWAP price must be positive",
      );
    });
    it("twap update after multiple observations", async function () {
      const ts = await getTime();
      const acc = Q112.mul(ts);
      const price = 1;
      await checkObservations(this.twapOracle, await this.token0.underlying(), ts, acc, 0);
      await increaseTime(100);
      await this.twapOracle.updateTwap(this.token0.address); // timestamp + 1
      // window doesn't change
      // await checkObservations(this.twapOracle, await this.token0.underlying(), ts, ts, acc, acc);

      await increaseTime(801);
      const result = await this.twapOracle.updateTwap(this.token0.address); // timestamp + 1
      // window changed
      const timeDelta = 801 + 100 + 1 + 1;
      await checkObservations(
        this.twapOracle,
        await this.token0.underlying(),
        ts + timeDelta,
        acc.add(Q112.mul(timeDelta).mul(price)),
        2,
      );
      await expect(result)
        .to.emit(this.twapOracle, "TwapWindowUpdated")
        .withArgs(
          await this.token0.underlying(),
          ts + 101,
          acc.add(Q112.mul(101)),
          ts + timeDelta,
          acc.add(Q112.mul(timeDelta)),
        );
    });
    it("should delete observation which does not fall in current window and add latest observation", async function () {
      const ts = await getTime();
      const acc = Q112.mul(ts);
      await checkObservations(this.twapOracle, await this.token0.underlying(), ts, acc, 0);
      await increaseTime(100);
      await this.twapOracle.updateTwap(this.token0.address); // timestamp + 1
      await increaseTime(801);
      await this.twapOracle.updateTwap(this.token0.address); // timestamp + 1
      // window changed
      const firstObservation = await this.twapOracle.observations(this.token0.underlying(), 0);
      expect(firstObservation.acc).to.be.equal(0);
      const lastObservation = await this.twapOracle.observations(this.token0.underlying(), 2);
      expect(lastObservation.timestamp).to.be.equal(ts + 903);
    });
    it("should pick last available observation if none observations are in window", async function () {
      const ts = await getTime();
      const acc = Q112.mul(ts);
      await checkObservations(this.twapOracle, await this.token0.underlying(), ts, acc, 0);
      await increaseTime(901);
      const result = await this.twapOracle.updateTwap(this.token0.address); // timestamp + 1
      // window changed
      const firstObservation = await this.twapOracle.observations(this.token0.underlying(), 0);
      expect(firstObservation.timestamp).to.be.equal(ts);

      const secondObservation = await this.twapOracle.observations(this.token0.underlying(), 1);
      expect(secondObservation.timestamp).to.be.equal(ts + 902);

      const windowStartIndex = await this.twapOracle.windowStart(this.token0.underlying());
      expect(windowStartIndex).to.be.equal(0);
      await expect(result)
        .to.emit(this.twapOracle, "TwapWindowUpdated")
        .withArgs(await this.token0.underlying(), ts, acc, ts + 902, acc.add(Q112.mul(902)));
    });
    it("should add latest observation after delete observations which does not fall in current window", async function () {
      const ts = await getTime();
      const acc = Q112.mul(ts);
      await checkObservations(this.twapOracle, await this.token0.underlying(), ts, acc, 0);
      await increaseTime(100);
      await this.twapOracle.updateTwap(this.token0.address); // timestamp + 1
      await increaseTime(801);
      await this.twapOracle.updateTwap(this.token0.address); // timestamp + 1
      // window changed
      const firstObservation = await this.twapOracle.observations(this.token0.underlying(), 0);
      expect(firstObservation.acc).to.be.equal(0);
      const lastObservation = await this.twapOracle.observations(this.token0.underlying(), 2);
      expect(lastObservation.timestamp).to.be.equal(ts + 903);
    });
    it("should delete multiple observation and pick observation which falling under window", async function () {
      const ts = await getTime();
      const acc = Q112.mul(ts);
      await checkObservations(this.twapOracle, await this.token0.underlying(), ts, acc, 0);
      await increaseTime(100);
      await this.twapOracle.updateTwap(this.token0.address); // timestamp + 1
      await increaseTime(100);
      await this.twapOracle.updateTwap(this.token0.address); // timestamp + 1
      await increaseTime(100);
      await this.twapOracle.updateTwap(this.token0.address); // timestamp + 1
      await increaseTime(100);
      await this.twapOracle.updateTwap(this.token0.address); // timestamp + 1
      await increaseTime(600);
      await this.twapOracle.updateTwap(this.token0.address); // timestamp + 1
      // window changed
      const firstObservation = await this.twapOracle.observations(this.token0.underlying(), 0);
      expect(firstObservation.timestamp).to.be.equal(0);
      const secondObservation = await this.twapOracle.observations(this.token0.underlying(), 1);
      expect(secondObservation.timestamp).to.be.equal(0);
      const thirdObservation = await this.twapOracle.observations(this.token0.underlying(), 2);
      expect(thirdObservation.timestamp).to.be.equal(ts + 202);
      const lastObservation = await this.twapOracle.observations(this.token0.underlying(), 5);
      expect(lastObservation.timestamp).to.be.equal(ts + 1005);
    });
    it("cumulative value", async function () {
      const currentTimestamp = await getTime();
      const acc = Q112.mul(currentTimestamp);
      let cp = await this.twapOracle.currentCumulativePrice(this.tokenConfig);
      // initial acc
      expect(cp).to.equal(acc);

      await increaseTime(100);
      cp = await this.twapOracle.currentCumulativePrice(this.tokenConfig);
      // increase the time but don't update the pair
      const acc1 = acc.add(Q112.mul(100));
      expect(cp).to.equal(acc1);

      // update the pair to update the timestamp, and test again
      await this.simplePair.update(100, 100, 100, 100); // timestamp + 1
      cp = await this.twapOracle.currentCumulativePrice(this.tokenConfig);
      const acc2 = acc1.add(Q112);
      expect(cp).to.equal(acc2);

      // change reserves, increase the time, and test again
      await increaseTime(33);
      await this.simplePair.update(200, 100, 200, 100); // timestamp + 1
      cp = await this.twapOracle.currentCumulativePrice(this.tokenConfig);
      const acc3 = acc2.add(
        Q112.mul(100)
          .div(200)
          .mul(33 + 1),
      );
      expect(cp).to.equal(acc3);

      // change reserves, increase the time, and test again
      await increaseTime(66);
      await this.simplePair.update(100, 400, 100, 400); // timestamp + 1
      cp = await this.twapOracle.currentCumulativePrice(this.tokenConfig);
      const acc4 = acc3.add(
        Q112.mul(400)
          .div(100)
          .mul(66 + 1),
      );
      expect(cp).to.equal(acc4);
    });
    it("test reversed pair", async function () {
      // choose another token
      const currentTimestamp = await getTime();
      const acc = Q112.mul(currentTimestamp);
      const pairLastTime = (await this.simplePair.getReserves())[2];
      const pairCp0 = BigNumber.from(pairLastTime).mul(Q112);
      const config = {
        asset: await this.token1.underlying(),
        baseUnit: EXP_SCALE,
        pancakePool: this.simplePair.address,
        isBnbBased: false,
        isReversedPool: true,
        anchorPeriod: 900, // 15min
      };
      // initial acc
      let cp = await this.twapOracle.currentCumulativePrice(config);
      expect(cp).to.equal(acc);

      await increaseTime(100);
      cp = await this.twapOracle.currentCumulativePrice(config);
      expect(cp).to.equal(acc.add(Q112.mul(100)));

      // update the pair to update the timestamp, and test again
      await this.simplePair.update(200, 100, 200, 100); // timestamp + 1
      cp = await this.twapOracle.currentCumulativePrice(config);
      const deltaTime = (await getTime()) - pairLastTime;
      // pair current cumulative price1 + delta cumulative price1
      expect(cp).to.equal(pairCp0.add(Q112.mul(200).div(100).mul(deltaTime)));
    });

    it("twap calculation for non BNB based token", async function () {
      let ts1 = await getTime();
      await this.simplePair.update(200, 100, 100, 100);
      let [cp0, pairLastTime] = [
        await this.simplePair.price0CumulativeLast(),
        (await this.simplePair.getReserves())[2],
      ];

      await increaseTime(1000);

      let result = await this.twapOracle.updateTwap(this.token0.address);
      let ts2 = await getTime();
      let oldObservation = await this.twapOracle.observations(await this.token0.underlying(), 0);
      let newAcc = Q112.mul(100)
        .div(200)
        .mul(ts2 - pairLastTime)
        .add(cp0);
      let oldAcc = oldObservation.acc;

      let avgPrice0 = newAcc
        .sub(oldAcc)
        .div(RATIO)
        .div(ts2 - oldObservation.timestamp.toNumber());

      await expect(result)
        .to.emit(this.twapOracle, "TwapWindowUpdated")
        .withArgs(await this.token0.underlying(), oldObservation.timestamp, oldObservation.acc, ts2, newAcc);
      await expect(result)
        .to.emit(this.twapOracle, "AnchorPriceUpdated")
        .withArgs(await this.token0.underlying(), avgPrice0, ts1, ts2);

      // check saved price
      let price = await this.twapOracle.getUnderlyingPrice(this.token0.address);
      expect(price).to.equal(avgPrice0);

      // ============= increase another 888, price change ============
      ts1 = await getTime();
      await this.simplePair.update(2000, 100, 200, 100);
      [cp0, pairLastTime] = [await this.simplePair.price0CumulativeLast(), (await this.simplePair.getReserves())[2]];

      await increaseTime(888);

      result = await this.twapOracle.updateTwap(this.token0.address);
      ts2 = await getTime();
      oldObservation = await this.twapOracle.observations(await this.token0.underlying(), 1);
      newAcc = Q112.mul(100)
        .div(2000)
        .mul(ts2 - pairLastTime)
        .add(cp0);
      oldAcc = oldObservation.acc;
      avgPrice0 = newAcc
        .sub(oldAcc)
        .div(RATIO)
        .div(ts2 - oldObservation.timestamp.toNumber());

      // >>> No TwapWindowUpdated event emitted <<<

      // old timestamp should be the timestamp of old observation
      await expect(result)
        .to.emit(this.twapOracle, "AnchorPriceUpdated")
        .withArgs(await this.token0.underlying(), avgPrice0, oldObservation.timestamp, ts2);

      // check saved price
      price = await this.twapOracle.getUnderlyingPrice(this.token0.address);
      expect(price).to.equal(avgPrice0);

      // @todo: maybe one more test - increase time no greater than anchorPeriod, nothing happen
    });

    describe("twap calculation for BNB based token", function () {
      beforeEach(async function () {
        // add bnb pair config

        const token0 = await makeVToken(
          this.admin,
          { name: "vETH", symbol: "vETH" },
          { name: "Ethereum", symbol: "ETH" },
        );
        const token1 = await makeVToken(
          this.admin,
          { name: "vMATIC", symbol: "vMATIC" },
          { name: "Matic", symbol: "MATIC" },
        );
        this.tokenConfig = {
          asset: await token0.underlying(),
          baseUnit: EXP_SCALE,
          pancakePool: this.bnbBasedPair.address,
          isBnbBased: true,
          isReversedPool: false,
          anchorPeriod: 900, // 15min
        };
        // prepare busd-bnb config
        this.bnbConfig = {
          asset: await this.vBnb.underlying(),
          baseUnit: EXP_SCALE,
          pancakePool: this.bnbPair.address,
          isBnbBased: false,
          isReversedPool: true,
          anchorPeriod: 600, // 10min
        };
        this.token0 = token0;
        this.token1 = token1;
        await this.twapOracle.setTokenConfig(this.tokenConfig);
      });
      it("if no BNB config is added, revert", async function () {
        await expect(this.twapOracle.updateTwap(this.token0.address)).to.be.revertedWith("WBNB not exist");
      });

      it("twap calculation", async function () {
        await this.twapOracle.setTokenConfig(this.bnbConfig);
        await this.bnbPair.update(1000, 100, 100, 100); // bnb: $10
        await this.bnbBasedPair.update(200, 100, 100, 100); // token: 0.5bnb

        // this only trigger bnb price update
        await increaseTime(666);

        // update bnb based pair
        let [cp0, pairLastTime] = [
          await this.bnbBasedPair.price0CumulativeLast(),
          (await this.bnbBasedPair.getReserves())[2],
        ];

        await this.twapOracle.updateTwap(this.token0.address);
        let oldObservation = await this.twapOracle.observations(await this.token0.underlying(), 0);

        // get bnb price here, after token0 twap updated, during which bnb price got updated again
        let bnbPrice = await this.twapOracle.getUnderlyingPrice(this.vBnb.address);

        let ts2 = await getTime();
        let newAcc = Q112.mul(100)
          .div(200)
          .mul(ts2 - pairLastTime)
          .add(cp0);
        let oldAcc = oldObservation.acc;
        let avgPrice0InBnb = newAcc
          .sub(oldAcc)
          .div(RATIO)
          .div(ts2 - oldObservation.timestamp.toNumber());
        let expectedPrice = avgPrice0InBnb.mul(bnbPrice).div(EXP_SCALE);
        expect(expectedPrice).to.equal(await this.twapOracle.getUnderlyingPrice(this.token0.address));

        // increase time and test again
        await increaseTime(800);
        [cp0, pairLastTime] = [
          await this.bnbBasedPair.price0CumulativeLast(),
          (await this.bnbBasedPair.getReserves())[2],
        ];

        await this.twapOracle.updateTwap(this.token0.address);

        oldObservation = await this.twapOracle.observations(await this.token0.underlying(), 1);
        bnbPrice = await this.twapOracle.getUnderlyingPrice(this.vBnb.address);
        ts2 = await getTime();
        newAcc = Q112.mul(100)
          .div(200)
          .mul(ts2 - pairLastTime)
          .add(cp0);
        oldAcc = oldObservation.acc;
        avgPrice0InBnb = newAcc
          .sub(oldAcc)
          .div(RATIO)
          .div(ts2 - oldObservation.timestamp.toNumber());
        expectedPrice = avgPrice0InBnb.mul(bnbPrice).div(EXP_SCALE);
        expect(expectedPrice).to.equal(await this.twapOracle.getUnderlyingPrice(this.token0.address));
      });
    });
  });

  describe("validation", function () {
    it("validate price", async function () {
      const token2 = await makeVToken(this.admin, { name: "vBNB2", symbol: "vBNB2" }, { name: "BNB2", symbol: "BNB2" });

      const validationConfig = {
        asset: await this.vToken1.underlying(),
        upperBoundRatio: EXP_SCALE.mul(12).div(10),
        lowerBoundRatio: EXP_SCALE.mul(8).div(10),
      };
      await this.boundValidator.setValidateConfigs([validationConfig]);

      // sanity check
      await expect(this.boundValidator.validatePriceWithAnchorPrice(token2.address, 100, 100)).to.be.revertedWith(
        "validation config not exist",
      );

      const tokenConfig = {
        asset: await this.vToken1.underlying(),
        baseUnit: EXP_SCALE,
        pancakePool: this.simplePair.address,
        isBnbBased: false,
        isReversedPool: true,
        anchorPeriod: 900, // 15min
      };
      await this.twapOracle.setTokenConfig(tokenConfig);

      // without updateTwap the price is not written and should revert
      await expect(this.twapOracle.getUnderlyingPrice(this.vToken1.address)).to.be.revertedWith(
        "TWAP price must be positive",
      );

      await this.twapOracle.updateTwap(this.vToken1.address);

      let validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        this.vToken1.address,
        EXP_SCALE,
        await this.twapOracle.getUnderlyingPrice(this.vToken1.address),
      );
      expect(validateResult).to.equal(true);
      validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        this.vToken1.address,
        EXP_SCALE.mul(100).div(79),
        await this.twapOracle.getUnderlyingPrice(this.vToken1.address),
      );
      expect(validateResult).to.equal(false);
      validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        this.vToken1.address,
        EXP_SCALE.mul(100).div(121),
        await this.twapOracle.getUnderlyingPrice(this.vToken1.address),
      );
      expect(validateResult).to.equal(false);
    });
  });
});
