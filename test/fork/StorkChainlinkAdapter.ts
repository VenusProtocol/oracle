import { SnapshotRestorer, takeSnapshot, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";

import { contracts as bscmainnet } from "../../deployments/bscmainnet.json";
import { ADDRESSES } from "../../helpers/deploymentConfig";
import { ChainlinkOracle, StorkChainlinkAdapter } from "../../typechain-types";
import { forking, initMainnetUser } from "./utils";

const FORK: boolean = process.env.FORK === "true";
const FORKED_NETWORK: string = process.env.FORKED_NETWORK || "";

const STORK = "0x7D06cc8210228365896A3cc8Aac88c5551529112";
const SUSN = "0xdA67B4284609d2d48e5d10cfAc411572727dc1eD";
// Stork's sUSN -> USN exchange rate, pushed hourly
const SUSN_FEED_ID = "0x77003d6da8f95711efa901495c607c987dfaedd55d24c6f935286f2851ed915e";
const STORK_VALID_TIME_PERIOD = 3600;
const MAX_STALE_PERIOD = 3900;

const STORK_ABI = [
  "function getTemporalNumericValueV1(bytes32 id) view returns (tuple(uint64 timestampNs, int192 quantizedValue))",
  "function validTimePeriodSeconds() view returns (uint256)",
  "error NotFound()",
  "error StaleValue()",
];

if (FORK && FORKED_NETWORK === "bscmainnet") {
  forking(133305000, () => {
    describe("StorkChainlinkAdapter on the Stork sUSN feed", () => {
      let stork: Contract;
      let adapter: StorkChainlinkAdapter;
      let chainlinkOracle: ChainlinkOracle;
      let storkUpdatedAt: number;

      before(async () => {
        stork = await ethers.getContractAt(STORK_ABI, STORK);
        const factory = await ethers.getContractFactory("StorkChainlinkAdapter");
        adapter = await factory.deploy(STORK, SUSN_FEED_ID);
        storkUpdatedAt = (await stork.getTemporalNumericValueV1(SUSN_FEED_ID)).timestampNs.div(1e9).toNumber();

        chainlinkOracle = await ethers.getContractAt("ChainlinkOracle", bscmainnet.ChainlinkOracle.address);
        const timelock = await initMainnetUser(ADDRESSES.bscmainnet.timelock, ethers.utils.parseEther("1"));
        await chainlinkOracle
          .connect(timelock)
          .setTokenConfig({ asset: SUSN, feed: adapter.address, maxStalePeriod: MAX_STALE_PERIOD });
      });

      it("returns Stork's value with the update time in seconds", async () => {
        const value = await stork.getTemporalNumericValueV1(SUSN_FEED_ID);
        const round = await adapter.latestRoundData();

        expect(round.answer).to.equal(value.quantizedValue);
        expect(round.updatedAt).to.equal(storkUpdatedAt);
        expect(round.updatedAt).to.be.lte(await time.latest());
      });

      it("lets the ChainlinkOracle price sUSN at the Stork value", async () => {
        const value = await stork.getTemporalNumericValueV1(SUSN_FEED_ID);
        expect(await chainlinkOracle.getPrice(SUSN)).to.equal(value.quantizedValue);
      });

      describe("as the value ages", () => {
        let snapshot: SnapshotRestorer;

        beforeEach(async () => {
          snapshot = await takeSnapshot();
        });

        afterEach(async () => {
          await snapshot.restore();
        });

        // Margins of 100s keep the checks clear of the exact block time the call runs at.
        it("keeps pricing until the value reaches Stork's 1-hour limit", async () => {
          expect(await stork.validTimePeriodSeconds()).to.equal(STORK_VALID_TIME_PERIOD);
          await time.increaseTo(storkUpdatedAt + STORK_VALID_TIME_PERIOD - 100);

          const value = await stork.getTemporalNumericValueV1(SUSN_FEED_ID);
          expect(await chainlinkOracle.getPrice(SUSN)).to.equal(value.quantizedValue);
        });

        // maxStalePeriod is 3,900s, so at 3,700s this is Stork's limit firing, not the ChainlinkOracle's.
        it("stops pricing once the value is older than Stork's 1-hour limit", async () => {
          await time.increaseTo(storkUpdatedAt + STORK_VALID_TIME_PERIOD + 100);
          await expect(chainlinkOracle.getPrice(SUSN)).to.be.revertedWithCustomError(stork, "StaleValue");
        });

        it("cannot be deployed while the value is older than Stork's 1-hour limit", async () => {
          await time.increaseTo(storkUpdatedAt + STORK_VALID_TIME_PERIOD + 100);
          const factory = await ethers.getContractFactory("StorkChainlinkAdapter");
          await expect(factory.deploy(STORK, SUSN_FEED_ID)).to.be.revertedWithCustomError(stork, "StaleValue");
        });
      });

      it("cannot be deployed for a feed Stork has never pushed", async () => {
        const factory = await ethers.getContractFactory("StorkChainlinkAdapter");
        await expect(factory.deploy(STORK, ethers.utils.id("USNUSD_RR_CAPPED_1"))).to.be.revertedWithCustomError(
          stork,
          "NotFound",
        );
      });
    });
  });
}
