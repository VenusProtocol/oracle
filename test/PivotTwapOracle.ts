import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import { PivotTwapOracle } from "../src/types/contracts/oracles/PivotTwapOracle";
import { addr0000, addr1111, getSimpleAddress } from "./utils/data";
import { makePairWithTokens } from "./utils/makePair";
import { makeToken } from "./utils/makeToken";
import { getTime, increaseTime } from "./utils/time";

const EXP_SCALE = BigNumber.from(10).pow(18);
const Q112 = BigNumber.from(2).pow(112);
const RATIO = Q112.div(EXP_SCALE); 

// helper functions
async function checkObservations(
  twapOracleContract: PivotTwapOracle,
  token: string,
  newTime: number,
  oldTime: number,
  newAcc: BigNumber,
  oldAcc: BigNumber,
) {
  // check observations
  const newObservation = await twapOracleContract.newObservations(token);
  const oldObservation = await twapOracleContract.oldObservations(token);
  expect(newObservation.timestamp).to.equal(newTime);
  expect(oldObservation.timestamp).to.equal(oldTime);
  expect(newObservation.acc).to.equal(newAcc);
  expect(oldObservation.acc).to.equal(oldAcc);
}


describe("Twap Oracle unit tests", function () {
  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin = signers[0];
    this.signers = signers;
    this.admin = admin;
    const vBnb = getSimpleAddress(8);

    const PivotTwapOracle = await ethers.getContractFactory("PivotTwapOracle", admin);
    const instance = <PivotTwapOracle>await upgrades.deployProxy(PivotTwapOracle, [vBnb]);
    this.twapOracle = instance;

    const token1 = await makeToken(this.admin, 'TOKEN1', 'TOKEN1', 18);
    const tokenBusd = await makeToken(this.admin, 'BUSD', 'BUSD', 18);
    const simplePair = await makePairWithTokens(this.admin, token1, tokenBusd);
    this.simplePair = simplePair;

    // set up bnb based pair for later test
    const token3 = await makeToken(this.admin, 'TOKEN3', 'TOKEN3', 18);
    const BEP20HarnessFactory = await ethers.getContractFactory('BEP20Harness');
    const tokenWbnb = BEP20HarnessFactory.attach(await this.twapOracle.vBNB());
    const bnbBasedPair = await makePairWithTokens(this.admin, token3, tokenWbnb);
    this.bnbBasedPair = bnbBasedPair;

    const bnbPair = await makePairWithTokens(this.admin, tokenBusd, tokenWbnb);
    this.bnbPair = bnbPair;
  });

  describe('constructor', function () {
    it('sets address of owner', async function () {
      const owner = await this.twapOracle.owner();
      expect(owner).to.equal(this.admin.address);
    });
  });

  describe('admin check', function () {
    it('only admin can call add token configs', async function () {
      // setTokenConfigs
      const config = {
        vToken: addr1111,
        baseUnit: 100,
        pancakePool: addr1111,
        isBnbBased: false,
        isReversedPool: false,
        anchorPeriod: 30,
      }
      await expect(
        this.twapOracle.connect(this.signers[2]).setTokenConfigs([config])
      ).to.be.revertedWith("Ownable: caller is not the owner");

      // setTokenConfig
      await expect(
        this.twapOracle.connect(this.signers[1]).setTokenConfig(config)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    })
    it('only admin can call add validation configs', async function () {
      const config = {
        vToken: addr1111,
        upperBoundRatio: EXP_SCALE.mul(12).div(10),
        lowerBoundRatio: EXP_SCALE.mul(8).div(10),
      }
      await expect(
        this.twapOracle.connect(this.signers[2]).setValidateConfigs([config])
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        this.twapOracle.connect(this.signers[1]).setValidateConfig(config)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    })
  });

  describe('token config', function () {
    describe('add single token config', function () {
      it('vToken can"t be zero & pool address can\'t be zero & anchorPeriod can\'t be 0', async function () {
        const config = {
          vToken: addr0000,
          baseUnit: 0,
          pancakePool: addr0000,
          isBnbBased: false,
          isReversedPool: false,
          anchorPeriod: 0,
        }
        await expect(
          this.twapOracle.setTokenConfig(config)
        ).to.be.revertedWith("can't be zero address");

        config.vToken = addr1111;
        await expect(
          this.twapOracle.setTokenConfig(config)
        ).to.be.revertedWith("can't be zero address");

        config.pancakePool = this.simplePair.address;
        await expect(
          this.twapOracle.setTokenConfig(config)
        ).to.be.revertedWith("anchor period must be positive");

        config.anchorPeriod = 100;
        await expect(
          this.twapOracle.setTokenConfig(config)
        ).to.be.revertedWith("base unit must be positive");
        config.baseUnit = 100;

        // nothing happen
        await this.twapOracle.setTokenConfig(config);
      });

      it('reset token config', async function () {
        const config1 = {
          vToken: addr1111,
          baseUnit: 100,
          pancakePool: this.simplePair.address,
          isBnbBased: true,
          isReversedPool: false,
          anchorPeriod: 10,
        };
        const config2 = {
          vToken: addr1111,
          baseUnit: 1000,
          pancakePool: this.simplePair.address,
          isBnbBased: false,
          isReversedPool: true,
          anchorPeriod: 100,
        };
        await this.twapOracle.setTokenConfig(config1);
        expect((await this.twapOracle.tokenConfigs(addr1111)).anchorPeriod).to.equal(10);
        await this.twapOracle.setTokenConfig(config2);
        expect((await this.twapOracle.tokenConfigs(addr1111)).anchorPeriod).to.equal(100);
      });

      it('token config added successfully & events check', async function () {
        const config = {
          vToken: addr1111,
          baseUnit: 100,
          pancakePool: this.simplePair.address,
          isBnbBased: false,
          isReversedPool: false,
          anchorPeriod: 888,
        };
        const result = await this.twapOracle.setTokenConfig(config);
        await expect(result).to.emit(this.twapOracle, 'TokenConfigAdded').withArgs(
          addr1111, this.simplePair.address, 888 
        );

        // starting accumulative price
        const ts = await getTime();
        const acc = Q112.mul(ts);
        await checkObservations(this.twapOracle, addr1111, ts, ts, acc, acc);
      });
    })

    describe('batch add token configs', function () {
      it('length check', async function () {
        await expect(
          this.twapOracle.setTokenConfigs([])
        ).to.be.revertedWith("length can't be 0");
      })

      it('token config added successfully & data check', async function () {
        const config = {
          vToken: addr1111,
          baseUnit: 100,
          pancakePool: this.simplePair.address,
          isBnbBased: false,
          isReversedPool: false,
          anchorPeriod: 888,
        };
        await this.twapOracle.setTokenConfigs([config]);
        const savedConfig = await this.twapOracle.tokenConfigs(addr1111);
        expect(savedConfig.anchorPeriod).to.equal(888);
        expect(savedConfig.vToken).to.equal(addr1111);
        expect(savedConfig.pancakePool).to.equal(this.simplePair.address);
        expect(savedConfig.baseUnit).to.equal(100);
      })
    });

  });

  describe('update twap', function () {
    beforeEach(async function () {
      const token0 = await this.simplePair.token0();
      const token1 = await this.simplePair.token1();
      this.tokenConfig = {
        vToken: token0,
        baseUnit: EXP_SCALE,
        pancakePool: this.simplePair.address,
        isBnbBased: false,
        isReversedPool: false,
        anchorPeriod: 900, // 15min
      };
      this.token0 = token0;
      this.token1 = token1;
      await this.twapOracle.setTokenConfig(this.tokenConfig);
    })
    it('revert if get underlying price of not existing token', async function () {
      await expect(
        this.twapOracle.getUnderlyingPrice(addr1111)
      ).to.be.revertedWith("vToken not exist");
    });
    it('revert if get underlying price of token has not been updated', async function () {
      await expect(
        this.twapOracle.getUnderlyingPrice(this.token0)
      ).to.be.revertedWith("TWAP price must be positive");
    });
    it('twap window update', async function () {
      const ts = await getTime();
      const token0 = await this.simplePair.token0();
      const acc = Q112.mul(ts);
      const price = 1;
      await checkObservations(this.twapOracle, token0, ts, ts, acc, acc);
      await increaseTime(100);
      await this.twapOracle.updateTwap(token0); // timestamp + 1
      // window doesn't change
      await checkObservations(this.twapOracle, token0, ts, ts, acc, acc);

      await increaseTime(801);
      const result = await this.twapOracle.updateTwap(token0); // timestamp + 1
      // window changed
      const timeDelta = 801 + 100 + 1 + 1;
      await checkObservations(this.twapOracle, token0, ts + timeDelta, ts, acc.add(Q112.mul(timeDelta).mul(price)), acc);
      await expect(result).to.emit(this.twapOracle, 'TwapWindowUpdated').withArgs(
        token0, ts, ts + timeDelta, acc, acc.add(Q112.mul(timeDelta))
      );
    });
    it('cumulative value', async function () {
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
      const acc3 = acc2.add(Q112.mul(100).div(200).mul(33 + 1));
      expect(cp).to.equal(acc3);

      // change reserves, increase the time, and test again
      await increaseTime(66);
      await this.simplePair.update(100, 400, 100, 400); // timestamp + 1
      cp = await this.twapOracle.currentCumulativePrice(this.tokenConfig);
      const acc4 = acc3.add(Q112.mul(400).div(100).mul(66 + 1))
      expect(cp).to.equal(acc4);
    });
    it('test reversed pair', async function () {
      // choose another token
      const currentTimestamp = await getTime();
      const acc = Q112.mul(currentTimestamp);
      const pairLastTime = (await this.simplePair.getReserves())[2];
      const pairCp0 = BigNumber.from(pairLastTime).mul(Q112);
      const token1 = await this.simplePair.token1(); // TOKEN0-TOKEN1
      const config = {
        vToken: token1,
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
      const deltaTime = await getTime() - pairLastTime;
      // pair current cumulative price1 + delta cumulative price1
      expect(cp).to.equal(pairCp0.add(Q112.mul(200).div(100).mul(deltaTime)));
    });

    it('twap calculation for non BNB based token', async function () {
      const token0 = await this.simplePair.token0();
      let ts1 = await getTime();
      await this.simplePair.update(200, 100, 100, 100);
      let [cp0, pairLastTime] = [
        await this.simplePair.price0CumulativeLast(),
        (await this.simplePair.getReserves())[2]
      ];

      await increaseTime(1000);
    
      let result = await this.twapOracle.updateTwap(token0);
      let ts2 = await getTime();
      let oldObservation = await this.twapOracle.oldObservations(token0);
      let newAcc = Q112.mul(100).div(200).mul(ts2 - pairLastTime).add(cp0);
      let oldAcc = oldObservation.acc;
      
      let avgPrice0 = newAcc.sub(oldAcc).div(RATIO).div(ts2 - oldObservation.timestamp.toNumber());

      await expect(result).to.emit(this.twapOracle, 'TwapWindowUpdated').withArgs(
        token0, oldObservation.timestamp, ts2, oldObservation.acc, newAcc
      );
      await expect(result).to.emit(this.twapOracle, 'AnchorPriceUpdated').withArgs(
        token0, avgPrice0, ts1, ts2
      );

      // check saved price
      let price = await this.twapOracle.getUnderlyingPrice(token0);
      expect(price).to.equal(avgPrice0);

      // ============= increase another 888, price change ============
      ts1 = await getTime();
      await this.simplePair.update(2000, 100, 200, 100);
      [cp0, pairLastTime] = [
        await this.simplePair.price0CumulativeLast(),
        (await this.simplePair.getReserves())[2]
      ];

      await increaseTime(888);

      result = await this.twapOracle.updateTwap(token0);
      ts2 = await getTime();
      oldObservation = await this.twapOracle.oldObservations(token0);
      newAcc = Q112.mul(100).div(2000).mul(ts2 - pairLastTime).add(cp0);
      oldAcc = oldObservation.acc;
      avgPrice0 = newAcc.sub(oldAcc).div(RATIO).div(ts2 - oldObservation.timestamp.toNumber());

      // >>> No TwapWindowUpdated event emitted <<<

      // old timestamp should be the timestamp of old observation
      await expect(result).to.emit(this.twapOracle, 'AnchorPriceUpdated').withArgs(
        token0, avgPrice0, oldObservation.timestamp, ts2
      );

      // check saved price
      price = await this.twapOracle.getUnderlyingPrice(token0);
      expect(price).to.equal(avgPrice0);
      
      // @todo: maybe one more test - increase time no greater than anchorPeriod, nothing happen
    });

    describe('twap calculation for BNB based token', function () {
      beforeEach(async function () {
        // add bnb pair config
        const token0 = await this.bnbBasedPair.token0();
        const token1 = await this.bnbBasedPair.token1();
        this.tokenConfig = {
          vToken: token0,
          baseUnit: EXP_SCALE,
          pancakePool: this.bnbBasedPair.address,
          isBnbBased: true,
          isReversedPool: false,
          anchorPeriod: 900, // 15min
        };
        // prepare busd-bnb config
        this.bnbConfig = {
          vToken: await this.twapOracle.vBNB(),
          baseUnit: EXP_SCALE,
          pancakePool: this.bnbPair.address,
          isBnbBased: false,
          isReversedPool: true,
          anchorPeriod: 600, // 10min
        }
        this.token0 = token0;
        this.token1 = token1;
        await this.twapOracle.setTokenConfig(this.tokenConfig);
      });
      it('if no BNB config is added, revert', async function () {
        await expect(
          this.twapOracle.updateTwap(this.token0)
        ).to.be.revertedWith("vTokne not exist");
      });

      it('twap calculation', async function () {
        await this.twapOracle.setTokenConfig(this.bnbConfig);
        await this.bnbPair.update(1000, 100, 100, 100); // bnb: $10
        await this.bnbBasedPair.update(200, 100, 100, 100); // token: 0.5bnb

        // this only trigger bnb price update
        await increaseTime(666);

        // update bnb based pair
        let [cp0, pairLastTime] = [
          await this.bnbBasedPair.price0CumulativeLast(),
          (await this.bnbBasedPair.getReserves())[2]
        ];

        await this.twapOracle.updateTwap(this.token0);
        let oldObservation = await this.twapOracle.oldObservations(this.token0);

        // get bnb price here, after token0 twap updated, during which bnb price got updated again
        const vbnb = await this.twapOracle.vBNB();
        let bnbPrice = await this.twapOracle.getUnderlyingPrice(vbnb);

        let ts2 = await getTime();
        let newAcc = Q112.mul(100).div(200).mul(ts2 - pairLastTime).add(cp0);
        let oldAcc = oldObservation.acc;
        let avgPrice0InBnb = newAcc.sub(oldAcc).div(RATIO).div(ts2 - oldObservation.timestamp.toNumber());
        let expectedPrice = avgPrice0InBnb.mul(bnbPrice).div(EXP_SCALE);
        expect(expectedPrice).to.equal(await this.twapOracle.getUnderlyingPrice(this.token0));

        // increase time and test again
        await increaseTime(800);
        [cp0, pairLastTime] = [
          await this.bnbBasedPair.price0CumulativeLast(),
          (await this.bnbBasedPair.getReserves())[2]
        ];

        await this.twapOracle.updateTwap(this.token0);

        oldObservation = await this.twapOracle.oldObservations(this.token0);
        bnbPrice = await this.twapOracle.getUnderlyingPrice(vbnb);
        ts2 = await getTime();
        newAcc = Q112.mul(100).div(200).mul(ts2 - pairLastTime).add(cp0);
        oldAcc = oldObservation.acc;
        avgPrice0InBnb = newAcc.sub(oldAcc).div(RATIO).div(ts2 - oldObservation.timestamp.toNumber());
        expectedPrice = avgPrice0InBnb.mul(bnbPrice).div(EXP_SCALE);
        expect(expectedPrice).to.equal(await this.twapOracle.getUnderlyingPrice(this.token0));
      });
    });
  })

  describe('validation', function () {
    it('validate price', async function () {
      const token0 = await this.simplePair.token0();
      const validationConfig = {
        vToken: token0,
        upperBoundRatio: EXP_SCALE.mul(12).div(10),
        lowerBoundRatio: EXP_SCALE.mul(8).div(10),
      }
      await this.twapOracle.setValidateConfigs([validationConfig]);

      // sanity check
      await expect(
        this.twapOracle.validatePrice(addr1111, 100)
      ).to.be.revertedWith("validation config not exist");
      
      const tokenConfig = {
        vToken: token0,
        baseUnit: EXP_SCALE,
        pancakePool: this.simplePair.address,
        isBnbBased: false,
        isReversedPool: true,
        anchorPeriod: 900, // 15min
      };
      await this.twapOracle.setTokenConfig(tokenConfig);

      // without updateTwap the price is not written and should revert
      await expect(
        this.twapOracle.validatePrice(token0, 100)
      ).to.be.revertedWith("anchor price is not valid");
        
      await this.twapOracle.updateTwap(token0);

      let validateResult = await this.twapOracle.validatePrice(token0, EXP_SCALE)
      expect(validateResult).to.equal(true);
      validateResult = await this.twapOracle.validatePrice(token0, EXP_SCALE.mul(100).div(79))
      expect(validateResult).to.equal(false);
      validateResult = await this.twapOracle.validatePrice(token0, EXP_SCALE.mul(100).div(121))
      expect(validateResult).to.equal(false);
    })
  })

});
