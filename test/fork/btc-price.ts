/* eslint-disable no-restricted-syntax */
import { smock } from "@defi-wonderland/smock";
import { impersonateAccount, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { BoundValidator, ChainlinkOracle, ResilientOracle } from "../../typechain-types";
import { forking } from "./utils";

const { expect } = chai;
chai.use(smock.matchers);

const FORK: boolean = process.env.FORK === "true";
const FORKED_NETWORK: string = process.env.FORKED_NETWORK || "";
const RESILIENT_ORACLE_ADDRESS = "0x6592b5DE802159F3E74B2486b091D11a8256ab8A";
const CHAINLINK_ORACLE = "0x1B2103441A0A108daD8848D8F5d790e4D402921F";
const REDSTONE_ORACLE = "0x8455EFA4D7Ff63b8BFD96AdD889483Ea7d39B70a";
const NORMAL_TIMELOCK = "0x939bD8d64c0A9583A7Dcea9933f7b21697ab6396";
const BTC = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c";
const REDSTONE_BTC_FEED = "0xa51738d1937FFc553d5070f43300B385AA2D9F55";
const REDSTONE_BTC_STALE_PERIOD = 60 * 60; // 1 hour
const BOUND_VALIFATOR = "0x6E332fF0bB52475304494E4AE5063c1051c7d735";

if (FORK && FORKED_NETWORK === "bscmainnet") {
  forking(38797419, () => {
    let resilientOracle: ResilientOracle;
    let redstoneOracle: ChainlinkOracle;
    let boundValdiator: BoundValidator;
    let chainlinkOracle: ChainlinkOracle;

    describe(`Price configuration validation`, () => {
      before(async () => {
        await impersonateAccount(NORMAL_TIMELOCK);
        await setBalance(NORMAL_TIMELOCK, parseUnits("1000", 18));

        resilientOracle = await ethers.getContractAt(
          "ResilientOracle",
          RESILIENT_ORACLE_ADDRESS,
          await ethers.getSigner(NORMAL_TIMELOCK),
        );
        redstoneOracle = await ethers.getContractAt(
          "ChainlinkOracle",
          REDSTONE_ORACLE,
          await ethers.getSigner(NORMAL_TIMELOCK),
        );
        boundValdiator = await ethers.getContractAt(
          "BoundValidator",
          BOUND_VALIFATOR,
          await ethers.getSigner(NORMAL_TIMELOCK),
        );
        chainlinkOracle = await ethers.getContractAt(
          "ChainlinkOracle",
          CHAINLINK_ORACLE,
          await ethers.getSigner(NORMAL_TIMELOCK),
        );

        // add BTC feed to redstone oracle
        await redstoneOracle.setTokenConfig({
          asset: BTC,
          feed: REDSTONE_BTC_FEED,
          maxStalePeriod: REDSTONE_BTC_STALE_PERIOD,
        });

        // add main, pivot and fallback oracle
        await resilientOracle.setTokenConfig({
          asset: BTC,
          oracles: [REDSTONE_ORACLE, CHAINLINK_ORACLE, CHAINLINK_ORACLE],
          enableFlagsForOracles: [true, true, true],
        });

        // set upper and lower bounds for price to be valid - we are setting price to be within 1% difference
        await boundValdiator.setValidateConfig({
          asset: BTC,
          upperBoundRatio: parseUnits("1.01", 18),
          lowerBoundRatio: parseUnits("0.99", 18),
        });

        console.log((await redstoneOracle.getPrice(BTC)).toString());
        console.log((await chainlinkOracle.getPrice(BTC)).toString());
      });

      it("Validate price", async () => {
        const redstonePrice = await redstoneOracle.getPrice(BTC);
        const resilientPrice = await resilientOracle.getPrice(BTC);
        expect(resilientPrice).to.be.eq(redstonePrice);
      });

      it("Invalidate price and use fallback", async () => {
        await boundValdiator.setValidateConfig({
          asset: BTC,
          upperBoundRatio: parseUnits("1.00000001", 18),
          lowerBoundRatio: parseUnits("1", 18),
        });

        const chainlinkPrice = await chainlinkOracle.getPrice(BTC);
        const resilientPrice = await resilientOracle.getPrice(BTC);
        expect(resilientPrice).to.be.eq(chainlinkPrice);
      });
    });
  });
}
