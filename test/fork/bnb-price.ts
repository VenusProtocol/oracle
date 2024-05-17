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
const BNB = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";
const REDSTONE_BNB_FEED = "0x8dd2D85C7c28F43F965AE4d9545189C7D022ED0e";
const REDSTONE_BNB_STALE_PERIOD = 60 * 60; // 1 hour
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

        // add BNB feed to redstone oracle
        await redstoneOracle.setTokenConfig({
          asset: BNB,
          feed: REDSTONE_BNB_FEED,
          maxStalePeriod: REDSTONE_BNB_STALE_PERIOD,
        });

        // add main, pivot and fallback oracle
        await resilientOracle.setTokenConfig({
          asset: BNB,
          oracles: [REDSTONE_ORACLE, CHAINLINK_ORACLE, CHAINLINK_ORACLE],
          enableFlagsForOracles: [true, true, true],
        });

        // set upper and lower bounds for price to be valid - we are setting price to be within 1% difference
        await boundValdiator.setValidateConfig({
          asset: BNB,
          upperBoundRatio: parseUnits("1.01", 18),
          lowerBoundRatio: parseUnits("0.99", 18),
        });

        console.log((await redstoneOracle.getPrice(BNB)).toString());
        console.log((await chainlinkOracle.getPrice(BNB)).toString());
      });

      it("Validate price", async () => {
        const redstonePrice = await redstoneOracle.getPrice(BNB);
        const resilientPrice = await resilientOracle.getPrice(BNB);
        expect(resilientPrice).to.be.eq(redstonePrice);
      });

      it("Invalidate price and use fallback", async () => {
        await boundValdiator.setValidateConfig({
          asset: BNB,
          upperBoundRatio: parseUnits("1.00000001", 18),
          lowerBoundRatio: parseUnits("1", 18),
        });

        const chainlinkPrice = await chainlinkOracle.getPrice(BNB);
        const resilientPrice = await resilientOracle.getPrice(BNB);
        expect(resilientPrice).to.be.eq(chainlinkPrice);
      });
    });
  });
}
