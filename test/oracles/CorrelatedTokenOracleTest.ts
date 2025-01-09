import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { ethers } from "hardhat";

const { expect } = chai;
chai.use(smock.matchers);

describe("CorrelatedTokenOracle", function () {
  let owner, user;
  let correlatedToken, underlyingToken, resilientOracle;
  let correlatedTokenOracle;

  // 5% annual growth rate
  const growthRate = ethers.utils.parseUnits("0.05", 18); // 5% annual growth
  // Snapshot update interval = 10 seconds
  const snapshotUpdateInterval = 10;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy mock tokens (ERC20) for correlated and underlying tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    correlatedToken = await MockERC20.deploy("Correlated Token", "C-TOKEN", 18);
    underlyingToken = await MockERC20.deploy("Underlying Token", "U-TOKEN", 18);

    // Deploy a mock resilient oracle
    const MockResilientOracle = await ethers.getContractFactory("MockResilientOracle");
    resilientOracle = await MockResilientOracle.deploy();

    // Deploy the CorrelatedTokenOracle contract
    const MockCorrelatedTokenOracle = await ethers.getContractFactory("MockCorrelatedTokenOracle");
    correlatedTokenOracle = await MockCorrelatedTokenOracle.deploy(
      correlatedToken.address,
      underlyingToken.address,
      resilientOracle.address,
      growthRate,
      snapshotUpdateInterval
    );

    await correlatedTokenOracle.setMockUnderlyingAmount(ethers.utils.parseUnits("1", 18));

    // Set mock price in resilient oracle for testing
    await resilientOracle.setPrice(underlyingToken.address, ethers.utils.parseUnits("10", 18)); // 10 USD
  });

  describe("Max Price Logic", () => {
    it("should return the correct price capped by the max allowed price", async function () {
      await correlatedTokenOracle.updateSnapshot();
      let price = await correlatedTokenOracle.getPrice(correlatedToken.address);
      expect(price).to.equal(ethers.utils.parseUnits("10", 18));

      // Let's simulate the price change for correlated token
      await resilientOracle.setPrice(correlatedToken.address, ethers.utils.parseUnits("110", 18)); // Price after manipulation

      await correlatedTokenOracle.updateSnapshot();
      price = await correlatedTokenOracle.getPrice(correlatedToken.address);

      //Assert that the price should be capped at the max allowed price
      expect(price).to.equal(ethers.utils.parseUnits("10", 18));
    });
  });
});
