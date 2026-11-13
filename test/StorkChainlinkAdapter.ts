import { FakeContract, smock } from "@defi-wonderland/smock";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

import { AccessControlManager, IStork, StorkChainlinkAdapter } from "../typechain-types";
import { ChainlinkOracle } from "../typechain-types/contracts/oracles/ChainlinkOracle";
import { addr0000 } from "./utils/data";
import { makeToken } from "./utils/makeToken";
import { getTime } from "./utils/time";

const PRICE_ID = ethers.utils.id("SUSNUSN_RR");
const VALUE = parseUnits("1.236497006", 18);
// Below Stork's 1-hour limit: on a real feed, that is the only setting where the ChainlinkOracle's check can fire.
const MAX_STALE_PERIOD = 1800;

const toNs = (seconds: number) => BigNumber.from(seconds).mul(1e9);

describe("StorkChainlinkAdapter", () => {
  let stork: FakeContract<IStork>;
  let adapter: StorkChainlinkAdapter;

  const setStorkValue = (timestampNs: BigNumber, quantizedValue: BigNumber = VALUE) =>
    stork.getTemporalNumericValueV1.returns({ timestampNs, quantizedValue });

  beforeEach(async () => {
    stork = await smock.fake<IStork>("IStork");
    setStorkValue(toNs(await getTime()));
    const factory = await ethers.getContractFactory("StorkChainlinkAdapter");
    adapter = await factory.deploy(stork.address, PRICE_ID);
  });

  describe("constructor", () => {
    it("stores the Stork contract and feed ID", async () => {
      expect(await adapter.STORK()).to.equal(stork.address);
      expect(await adapter.PRICE_ID()).to.equal(PRICE_ID);
    });

    it("reverts when Stork has no value for the feed ID", async () => {
      stork.getTemporalNumericValueV1.reverts();
      const factory = await ethers.getContractFactory("StorkChainlinkAdapter");
      await expect(factory.deploy(stork.address, PRICE_ID)).to.be.reverted;
    });

    it("reverts for a zero Stork address", async () => {
      const factory = await ethers.getContractFactory("StorkChainlinkAdapter");
      await expect(factory.deploy(addr0000, PRICE_ID)).to.be.reverted;
    });
  });

  describe("latestRoundData", () => {
    it("reports the update time in seconds, rounded down", async () => {
      setStorkValue(BigNumber.from("1700000000999999999"));

      const round = await adapter.latestRoundData();

      expect(round.answer).to.equal(VALUE);
      expect(round.startedAt).to.equal(1700000000);
      expect(round.updatedAt).to.equal(1700000000);
      expect(round.roundId).to.equal(1700000000);
      expect(round.answeredInRound).to.equal(1700000000);
    });
  });

  it("reports 18 decimals, the scale of every Stork value", async () => {
    expect(await adapter.decimals()).to.equal(18);
  });

  describe("read by the ChainlinkOracle", () => {
    let chainlinkOracle: ChainlinkOracle;
    let asset: string;

    beforeEach(async () => {
      const acm = await smock.fake<AccessControlManager>("AccessControlManager");
      acm.isAllowedToCall.returns(true);
      const factory = await ethers.getContractFactory("ChainlinkOracle");
      chainlinkOracle = <ChainlinkOracle>await upgrades.deployProxy(factory, [acm.address], { constructorArgs: [] });

      asset = (await makeToken("sUSN", "sUSN")).address;
      await chainlinkOracle.setTokenConfig({ asset, feed: adapter.address, maxStalePeriod: MAX_STALE_PERIOD });
    });

    it("prices the asset at the Stork value", async () => {
      expect(await chainlinkOracle.getPrice(asset)).to.equal(VALUE);
    });

    // Margins of 100s keep the checks clear of the exact block time the call runs at.
    it("keeps pricing while the value is younger than maxStalePeriod", async () => {
      setStorkValue(toNs((await getTime()) - (MAX_STALE_PERIOD - 100)));
      expect(await chainlinkOracle.getPrice(asset)).to.equal(VALUE);
    });

    it("stops pricing once the value is older than maxStalePeriod", async () => {
      setStorkValue(toNs((await getTime()) - (MAX_STALE_PERIOD + 100)));
      await expect(chainlinkOracle.getPrice(asset)).to.be.revertedWith("chainlink price expired");
    });

    // The fake can only revert with a string; the fork test checks the real `StaleValue()` from Stork.
    it("stops pricing when Stork rejects the value, passing its revert through", async () => {
      stork.getTemporalNumericValueV1.reverts("stork rejected the value");
      await expect(chainlinkOracle.getPrice(asset)).to.be.revertedWith("stork rejected the value");
    });
  });
});
