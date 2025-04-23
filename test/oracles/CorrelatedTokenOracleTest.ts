import { smock } from "@defi-wonderland/smock";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import chai from "chai";
import { ethers } from "hardhat";

import { AccessControlManager, ResilientOracle } from "../../typechain-types";

const { expect } = chai;
chai.use(smock.matchers);

describe("CorrelatedTokenOracle", () => {
  let correlatedToken;
  let underlyingToken;
  let correlatedTokenOracle;
  let timestamp;
  let mockOracle;

  // 5% annual growth rate
  const growthRate = ethers.utils.parseUnits("0.05", 18); // 5% annual growth
  // Snapshot update interval = 10 seconds
  const snapshotUpdateInterval = 10;
  const exchangeRate = ethers.utils.parseUnits("1", 18);

  beforeEach(async () => {
    ({ timestamp } = await ethers.provider.getBlock("latest"));

    // Deploy mock tokens (ERC20) for correlated and underlying tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    correlatedToken = await MockERC20.deploy("Correlated Token", "C-TOKEN", 18);
    underlyingToken = await MockERC20.deploy("Underlying Token", "U-TOKEN", 18);

    // Deploy Bound Validator
    const BoundValidator = await ethers.getContractFactory("BoundValidator");
    const boundValidator = await BoundValidator.deploy();

    // Deploy Mock Oracle
    const MockOracle = await ethers.getContractFactory("MockOracle");
    mockOracle = await MockOracle.deploy();
    mockOracle.setPrice(underlyingToken.address, ethers.utils.parseUnits("10", 18)); // 10 USD

    const fakeAccessControlManager = await smock.fake<AccessControlManager>("AccessControlManager");
    fakeAccessControlManager.isAllowedToCall.returns(true);

    const ResilientOracleFactory = await ethers.getContractFactory("ResilientOracle");
    const resilientOracle = <ResilientOracle>await upgrades.deployProxy(
      ResilientOracleFactory,
      [fakeAccessControlManager.address],
      {
        constructorArgs: [ethers.constants.AddressZero, ethers.constants.AddressZero, boundValidator.address],
      },
    );

    await resilientOracle.setTokenConfig({
      asset: underlyingToken.address,
      oracles: [mockOracle.address, ethers.constants.AddressZero, ethers.constants.AddressZero],
      enableFlagsForOracles: [true, false, false],
      cachingEnabled: false,
    });

    // Deploy the CorrelatedTokenOracle contract
    const MockCorrelatedTokenOracle = await ethers.getContractFactory("MockCorrelatedTokenOracle");
    correlatedTokenOracle = await MockCorrelatedTokenOracle.deploy(
      correlatedToken.address,
      underlyingToken.address,
      resilientOracle.address,
      growthRate,
      snapshotUpdateInterval,
      exchangeRate,
      timestamp,
      fakeAccessControlManager.address,
      1000,
    );

    await correlatedTokenOracle.setMockUnderlyingAmount(exchangeRate);
  });

  describe("Max Price Logic", () => {
    it("should return the correct price capped by the max allowed price", async () => {
      await correlatedTokenOracle.updateSnapshot();
      let price = await correlatedTokenOracle.getPrice(correlatedToken.address);
      expect(price).to.equal(ethers.utils.parseUnits("10", 18));

      // Let's simulate the price change for correlated token
      await correlatedTokenOracle.setMockUnderlyingAmount(ethers.utils.parseUnits("1.5", 18)); // 50% increase

      // Update the snapshot
      await mine(365 * 24 * 60 * 60); // Simulate one year
      await correlatedTokenOracle.updateSnapshot();
      price = await correlatedTokenOracle.getPrice(correlatedToken.address);

      // Assert that the price should be capped at the max allowed price
      expect(price).to.be.equal(ethers.utils.parseUnits("10.500000031650452480", 18));

      // eslint-disable-next-line no-unused-expressions
      expect(await correlatedTokenOracle.isCapped()).to.be.true;
    });

    it("change growth rate", async () => {
      await correlatedTokenOracle.updateSnapshot();
      let price = await correlatedTokenOracle.getPrice(correlatedToken.address);
      expect(price).to.equal(ethers.utils.parseUnits("10", 18));

      // Let's simulate the price change for correlated token
      await correlatedTokenOracle.setMockUnderlyingAmount(ethers.utils.parseUnits("1.5", 18)); // 50% increase
      await correlatedTokenOracle.setGrowthRate(ethers.utils.parseUnits("0.5", 18), snapshotUpdateInterval); // 50% growth rate

      // Update the snapshot
      await mine(365 * 24 * 60 * 60); // Simulate one year
      await correlatedTokenOracle.updateSnapshot();
      price = await correlatedTokenOracle.getPrice(correlatedToken.address);

      // Assert that the price should be capped at the max allowed price
      expect(price).to.be.equal(ethers.utils.parseUnits("15", 18));
    });

    it("disable capping", async () => {
      await correlatedTokenOracle.updateSnapshot();
      let price = await correlatedTokenOracle.getPrice(correlatedToken.address);
      expect(price).to.equal(ethers.utils.parseUnits("10", 18));

      // Let's simulate the price change for correlated token
      await correlatedTokenOracle.setMockUnderlyingAmount(ethers.utils.parseUnits("2", 18)); // 50% increase
      await correlatedTokenOracle.setGrowthRate(0, 0);

      // Update the snapshot
      await mine(365 * 24 * 60 * 60); // Simulate one year
      await correlatedTokenOracle.updateSnapshot();
      price = await correlatedTokenOracle.getPrice(correlatedToken.address);

      // Assert that the price should be capped at the max allowed price
      expect(price).to.be.equal(ethers.utils.parseUnits("20", 18));

      // eslint-disable-next-line no-unused-expressions
      expect(await correlatedTokenOracle.isCapped()).to.be.false;
    });
  });
});
