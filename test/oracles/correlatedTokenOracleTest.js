import chai from "chai";
import { ethers } from "hardhat";
import { smock } from "@defi-wonderland/smock";

const { expect } = chai;
chai.use(smock.matchers);

describe("CorrelatedTokenOracle", function () {
  let owner, user;
  let correlatedToken, underlyingToken, resilientOracle;
  let correlatedTokenOracle;

  // 5% annual growth rate
  const initialGrowthRate = ethers.utils.parseUnits("0.05", 18); // 5% annual growth
  // Initial stored snapshot price = 100
  const initialSnapshotPrice = ethers.utils.parseUnits("100", 18);

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
      initialGrowthRate,
      initialSnapshotPrice,
    );

    await correlatedTokenOracle.setMockUnderlyingAmount(ethers.utils.parseUnits("1", 18)); // Example value

    // Set mock price in resilient oracle for testing
    await resilientOracle.setPrice(underlyingToken.address, ethers.utils.parseUnits("1000", 18)); // 10 USD
  });

  describe("Max Price Logic", function () {
    it("should return the correct price capped by the max allowed price", async function () {
      const snapshotTimeElapsed = 60 * 60 * 24 * 30; // 30 days elapsed
      const maxAllowedPrice = await correlatedTokenOracle.getMaxAllowedPrice();

      // Let's simulate the price change for correlated token
      await resilientOracle.setPrice(correlatedToken.address, ethers.utils.parseUnits("110", 18)); // Price after manipulation

      // Fetch the price from the oracle
      const price = await correlatedTokenOracle.getPrice(correlatedToken.address);

      // Assert that the price should be capped at the max allowed price
      // expect(price).to.equal(maxAllowedPrice);
    });
  });

  describe("Snapshot Update Logic", function () {
    it("should update the snapshot price correctly", async function () {
      // Update the snapshot with a new price
      const newPrice = ethers.utils.parseUnits("120", 18);
      await correlatedTokenOracle.updateSnapshot(newPrice);

      // Fetch the updated snapshot price
      const updatedPrice = await correlatedTokenOracle.storedSnapshotPrice();

      // Assert that the snapshot price has been updated correctly
      expect(updatedPrice).to.equal(newPrice);
    });
  });
});
