import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { AggregatorV3Interface, SequencerChainlinkOracle, SequencerChainlinkOracle__factory } from "../typechain-types";
import { getTime } from "./utils/time";

const { expect } = chai;
chai.use(smock.matchers);

describe("SequencerChainlinkOracle", () => {
  let sequencerChainlinkOracle: MockContract<SequencerChainlinkOracle>;
  let sequencerFeed: FakeContract<AggregatorV3Interface>;
  const BNB_ADDR = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";
  const GRACE_PERIOD = 3600;
  const expectedPrice = parseUnits("1", 18);
  before(async () => {
    await ethers.provider.send("evm_mine", []); // Mine a block to ensure provider is initialized
    sequencerFeed = await smock.fake("AggregatorV3Interface");
    const sequencerChainlinkOracleFactory = await smock.mock<SequencerChainlinkOracle__factory>(
      "SequencerChainlinkOracle",
    );
    sequencerChainlinkOracle = await sequencerChainlinkOracleFactory.deploy(sequencerFeed.address);
    // configure a hardcoded price just for the sake of returning any value
    await sequencerChainlinkOracle.setVariable("prices", {
      "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB": expectedPrice, // native-token address hardcoded price
    });
  });
  it("Should revert if sequencer is down", async () => {
    sequencerFeed.latestRoundData.returns({
      roundId: 0, // arbitraty value (not used in logic)
      answer: 1, // (1 - for 'sequencer down')
      startedAt: 1, // block.timestamp - startedAt should be > 3600 (GRACE_PERIOD)
      updatedAt: 1, // arbitraty value (not used in logic)
      answeredInRound: 1, // arbitraty value (not used in logic)
    });

    await expect(sequencerChainlinkOracle.getPrice(BNB_ADDR)).to.be.revertedWith("L2 sequencer unavailable");
  });
  it("Should revert if sequencer is up, but GRACE_PERIOD has not passed", async () => {
    sequencerFeed.latestRoundData.returns({
      roundId: 0, // arbitraty value (not used in logic)
      answer: 1, // (1 - for 'sequencer down')
      startedAt: (await getTime()) - GRACE_PERIOD, // block.timestamp - startedAt should be = 3600 (GRACE_PERIOD)
      updatedAt: 1, // arbitraty value (not used in logic)
      answeredInRound: 1, // arbitraty value (not used in logic)
    });

    await expect(sequencerChainlinkOracle.getPrice(BNB_ADDR)).to.be.revertedWith("L2 sequencer unavailable");

    sequencerFeed.latestRoundData.returns({
      roundId: 0, // arbitraty value (not used in logic)
      answer: 1, // (1 - for 'sequencer down')
      startedAt: await getTime(), // block.timestamp - startedAt should be < 3600 (GRACE_PERIOD)
      updatedAt: 1, // arbitraty value (not used in logic)
      answeredInRound: 1, // arbitraty value (not used in logic)
    });

    await expect(sequencerChainlinkOracle.getPrice(BNB_ADDR)).to.be.revertedWith("L2 sequencer unavailable");
  });
  it("Should return price", async () => {
    sequencerFeed.latestRoundData.returns({
      roundId: 0, // arbitraty value (not used in logic)
      answer: 0, // (0 - for 'sequencer up')
      startedAt: 1, // block.timestamp - startedAt should be > 3600 (GRACE_PERIOD)
      updatedAt: 1, // arbitraty value (not used in logic)
      answeredInRound: 1, // arbitraty value (not used in logic)
    });

    expect(await sequencerChainlinkOracle.getPrice(BNB_ADDR)).to.equal(expectedPrice);
  });
});
