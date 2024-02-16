import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

import {
  ADDRESSES,
  Asset,
  DEFAULT_STALE_PERIOD,
  Feed,
  assets,
  chainlinkFeed,
  getOraclesToDeploy,
  pythID,
  redstoneFeed,
} from "../../helpers/deploymentConfig";
import {
  AccessControlManager__factory,
  BinanceOracle,
  BinanceOracle__factory,
  BoundValidator,
  BoundValidator__factory,
  ChainlinkOracle,
  ChainlinkOracle__factory,
  PythOracle,
  PythOracle__factory,
  ResilientOracle,
  ResilientOracle__factory,
} from "../../typechain-types";

const DEFAULT_PRICE = "1000000000000000000"; // $1
const FORK = process.env.FORK === "true";
const FORKED_NETWORK: string = process.env.FORKED_NETWORK || "";

const networkAddresses = ADDRESSES[FORKED_NETWORK];

interface OracleFixture {
  resilientOracle: ResilientOracle;
  boundValidator: BoundValidator;
  chainlinkOracle: ChainlinkOracle | undefined;
  redStoneOracle: ChainlinkOracle | undefined;
  pythOracle: PythOracle | undefined;
  binanceOracle: BinanceOracle | undefined;
}

async function deployOracleFixture(): Promise<OracleFixture> {
  const oraclesToDeploy = await getOraclesToDeploy(FORKED_NETWORK);
  const signers = await (ethers as any).getSigners();
  const deployer = signers[0];

  const AccessControlManagerFactory: AccessControlManager__factory = await ethers.getContractFactory(
    "AccessControlManager",
  );
  const accessControlManager = await AccessControlManagerFactory.deploy();

  const BoundValidatorFactory: BoundValidator__factory = await ethers.getContractFactory("BoundValidator");
  const boundValidator = <BoundValidator>await upgrades.deployProxy(
    BoundValidatorFactory,
    [accessControlManager.address],
    {
      constructorArgs: [],
    },
  );

  const ResilientOracleFactory: ResilientOracle__factory = await ethers.getContractFactory("ResilientOracle");
  const resilientOracle = <ResilientOracle>await upgrades.deployProxy(
    ResilientOracleFactory,
    [accessControlManager.address],
    {
      constructorArgs: [networkAddresses.vBNBAddress, networkAddresses.VAIAddress, boundValidator.address],
    },
  );

  await accessControlManager.giveCallPermission(
    resilientOracle.address,
    "setTokenConfig(TokenConfig)",
    deployer.address,
  );

  let chainlinkOracle;
  if (oraclesToDeploy.chainlink) {
    const ChainlinkOracleFactory: ChainlinkOracle__factory = await ethers.getContractFactory("ChainlinkOracle");
    chainlinkOracle = <ChainlinkOracle>await upgrades.deployProxy(
      ChainlinkOracleFactory,
      [accessControlManager.address],
      {
        constructorArgs: [],
      },
    );

    await accessControlManager.giveCallPermission(
      chainlinkOracle.address,
      "setTokenConfig(TokenConfig)",
      deployer.address,
    );

    await accessControlManager.giveCallPermission(
      chainlinkOracle.address,
      "setDirectPrice(address,uint256)",
      deployer.address,
    );
  }

  let redStoneOracle;
  if (oraclesToDeploy.redstone) {
    const ChainlinkOracleFactory: ChainlinkOracle__factory = await ethers.getContractFactory("ChainlinkOracle");
    redStoneOracle = <ChainlinkOracle>await upgrades.deployProxy(
      ChainlinkOracleFactory,
      [accessControlManager.address],
      {
        constructorArgs: [],
      },
    );

    await accessControlManager.giveCallPermission(
      redStoneOracle.address,
      "setTokenConfig(TokenConfig)",
      deployer.address,
    );

    await accessControlManager.giveCallPermission(
      redStoneOracle.address,
      "setDirectPrice(address,uint256)",
      deployer.address,
    );
  }

  let pythOracle;
  if (oraclesToDeploy.pyth) {
    const PythOracleFactory: PythOracle__factory = await ethers.getContractFactory("PythOracle");
    pythOracle = <PythOracle>await upgrades.deployProxy(
      PythOracleFactory,
      [networkAddresses.pythOracleAddress, accessControlManager.address],
      {
        constructorArgs: [],
      },
    );
  }

  let binanceOracle;
  if (oraclesToDeploy.pyth) {
    const BinanceOracleFactory: BinanceOracle__factory = await ethers.getContractFactory("BinanceOracle");
    binanceOracle = <BinanceOracle>await upgrades.deployProxy(
      BinanceOracleFactory,
      [networkAddresses.sidRegistryAddress, accessControlManager.address],
      {
        constructorArgs: [],
      },
    );

    await accessControlManager.giveCallPermission(pythOracle.address, "setTokenConfig(TokenConfig)", deployer.address);

    await accessControlManager.giveCallPermission(
      binanceOracle.address,
      "setMaxStalePeriod(string,uint256)",
      deployer.address,
    );
  }

  return { resilientOracle, boundValidator, chainlinkOracle, redStoneOracle, pythOracle, binanceOracle };
}

if (FORK) {
  describe(`Oracle Compatibility on ${FORKED_NETWORK}`, () => {
    let resilientOracle: ResilientOracle;
    let chainlinkOracle: ChainlinkOracle | undefined;
    let redStoneOracle: ChainlinkOracle | undefined;
    let pythOracle: PythOracle | undefined;

    // remove binance oracle
    const assetsConfig: Asset[] = assets[FORKED_NETWORK].filter(asset => asset.oracle !== "binance");

    const chainlinkFeeds: Feed = chainlinkFeed[FORKED_NETWORK];
    const redStoneFeeds: Feed = redstoneFeed[FORKED_NETWORK];
    const pythIDs: Feed = pythID[FORKED_NETWORK];
    before(async () => {
      // Load the fixture for oracle deployment
      ({ resilientOracle, chainlinkOracle, redStoneOracle, pythOracle } = await loadFixture(deployOracleFixture));
    });

    // Iterate over each asset and create a test
    assetsConfig.forEach(asset => {
      describe(`Validate ${asset.token} config`, () => {
        // eslint-disable-next-line prefer-arrow-callback, func-names
        it(`${asset.token} `, async function () {
          // Configure the oracle based on the asset's details
          const assetName = asset.token;
          const stalePeriod = asset.stalePeriod ? asset.stalePeriod : DEFAULT_STALE_PERIOD;
          const directPrice = asset.price ? asset.price : DEFAULT_PRICE;
          if (chainlinkOracle && (asset.oracle === "chainlink" || asset.oracle === "chainlinkFixed")) {
            if (asset.oracle === "chainlink") {
              await chainlinkOracle.setTokenConfig({
                asset: asset.address,
                feed: chainlinkFeeds[assetName],
                maxStalePeriod: stalePeriod,
              });
            } else {
              await chainlinkOracle.setDirectPrice(asset.address, directPrice);
            }
            await resilientOracle.setTokenConfig({
              asset: asset.address,
              oracles: [chainlinkOracle.address, ethers.constants.AddressZero, ethers.constants.AddressZero],
              enableFlagsForOracles: [true, false, false],
            });
          } else if (redStoneOracle && asset.oracle === "redstone") {
            await redStoneOracle.setTokenConfig({
              asset: asset.address,
              feed: redStoneFeeds[assetName],
              maxStalePeriod: stalePeriod,
            });
            await resilientOracle.setTokenConfig({
              asset: asset.address,
              oracles: [redStoneOracle.address, ethers.constants.AddressZero, ethers.constants.AddressZero],
              enableFlagsForOracles: [true, false, false],
            });
          } else if (pythOracle && asset.oracle === "pyth") {
            await pythOracle.setTokenConfig({
              pythId: pythIDs[asset.token],
              asset: asset.address,
              maxStalePeriod: stalePeriod,
            });
            await resilientOracle.setTokenConfig({
              asset: asset.address,
              oracles: [pythOracle.address, ethers.constants.AddressZero, ethers.constants.AddressZero],
              enableFlagsForOracles: [true, false, false],
            });
          }
          let price;
          try {
            price = await resilientOracle.getPrice(asset.address);
          } catch (error) {
            expect.fail(error);
          }
          expect(price).to.be.instanceOf(ethers.BigNumber);

          // Print the price in the it test title
          this.test.title += `(Price: ${price.toString()})`;
        });
      });
    });
  });
}
