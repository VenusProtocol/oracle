import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

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
  TwapOracle,
  TwapOracle__factory,
} from "../../typechain-types";

const FORK_MAINNET = process.env.FORK_MAINNET === "true";
const vBNB = "0xA07c5b74C9B40447a954e1466938b865b6BBea36";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const PythOracleAddress = "0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594";
const SIDRegistryAddress = "0x08CEd32a7f3eeC915Ba84415e9C07a7286977956";
const BNBAddress = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";
const VAI = "0x4BD17003473389A42DAF6a0a729f6Fdb328BbBd7";

interface OracleFixture {
  resilientOracle: ResilientOracle;
  boundValidator: BoundValidator;
  chainlinkOracle: ChainlinkOracle;
  twapOracle: TwapOracle;
  pythOracle: PythOracle;
  binanceOracle: BinanceOracle;
}

async function deployOracleFixture(): Promise<OracleFixture> {
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
      constructorArgs: [vBNB, VAI, boundValidator.address],
    },
  );

  const ChainlinkOracleFactory: ChainlinkOracle__factory = await ethers.getContractFactory("ChainlinkOracle");
  const chainlinkOracle = <ChainlinkOracle>await upgrades.deployProxy(
    ChainlinkOracleFactory,
    [accessControlManager.address],
    {
      constructorArgs: [],
    },
  );

  const TwapOracleFactory: TwapOracle__factory = await ethers.getContractFactory("TwapOracle");
  const twapOracle = <TwapOracle>await upgrades.deployProxy(TwapOracleFactory, [accessControlManager.address], {
    constructorArgs: [WBNB],
  });

  const PythOracleFactory: PythOracle__factory = await ethers.getContractFactory("PythOracle");
  const pythOracle = <PythOracle>await upgrades.deployProxy(
    PythOracleFactory,
    [PythOracleAddress, accessControlManager.address],
    {
      constructorArgs: [],
    },
  );

  const BinanceOracleFactory: BinanceOracle__factory = await ethers.getContractFactory("BinanceOracle");
  const binanceOracle = <BinanceOracle>await upgrades.deployProxy(
    BinanceOracleFactory,
    [SIDRegistryAddress, accessControlManager.address, WBNB],
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
    resilientOracle.address,
    "setTokenConfig(TokenConfig)",
    deployer.address,
  );

  await accessControlManager.giveCallPermission(
    binanceOracle.address,
    "setMaxStalePeriod(string,uint256)",
    deployer.address,
  );

  return { resilientOracle, boundValidator, chainlinkOracle, twapOracle, pythOracle, binanceOracle };
}

describe("Core protocol", async () => {
  let resilientOracle: ResilientOracle;
  let chainlinkOracle: ChainlinkOracle;

  if (FORK_MAINNET) {
    beforeEach("deploy and configure XVSVault contracts", async () => {
      ({ resilientOracle, chainlinkOracle } = await loadFixture(deployOracleFixture));
    });

    it("validate vBNB price", async () => {
      // Configure price feed for vBNB
      await chainlinkOracle.setTokenConfig({
        asset: BNBAddress,
        feed: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
        maxStalePeriod: 864000,
      });

      await resilientOracle.setTokenConfig({
        asset: BNBAddress,
        oracles: [chainlinkOracle.address, ethers.constants.AddressZero, ethers.constants.AddressZero],
        enableFlagsForOracles: [true, false, false],
      });

      const price = await resilientOracle.getUnderlyingPrice(vBNB);
      expect(price).to.be.equal("274310000000000000000");
    });

    it("validate vLTC price", async () => {
      const LTCAddress = "0x4338665CBB7B2485A8855A139b75D5e34AB0DB94";
      const vLTCAddress = "0x57A5297F2cB2c0AaC9D554660acd6D385Ab50c6B";

      // Configure price feed for vLTC
      await chainlinkOracle.setTokenConfig({
        asset: LTCAddress,
        feed: "0x74e72f37a8c415c8f1a98ed42e78ff997435791d",
        maxStalePeriod: 864000,
      });

      await resilientOracle.setTokenConfig({
        asset: LTCAddress,
        oracles: [chainlinkOracle.address, ethers.constants.AddressZero, ethers.constants.AddressZero],
        enableFlagsForOracles: [true, false, false],
      });

      const price = await resilientOracle.getUnderlyingPrice(vLTCAddress);
      expect(price).to.be.equal("70780000000000000000");
    });

    it("validate vXVS price", async () => {
      const XVSAddress = "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63";
      const vXVSAddress = "0x151B1e2635A717bcDc836ECd6FbB62B674FE3E1D";

      // Configure price feed for vXVS
      await chainlinkOracle.setTokenConfig({
        asset: XVSAddress,
        feed: "0xbf63f430a79d4036a5900c19818aff1fa710f206",
        maxStalePeriod: 864000,
      });

      await resilientOracle.setTokenConfig({
        asset: XVSAddress,
        oracles: [chainlinkOracle.address, ethers.constants.AddressZero, ethers.constants.AddressZero],
        enableFlagsForOracles: [true, false, false],
      });

      const price = await resilientOracle.getUnderlyingPrice(vXVSAddress);
      expect(price).to.be.equal("4412797480000000000");
    });

    it("validate VAI price", async () => {
      // Configure price feed for VAI
      await chainlinkOracle.setTokenConfig({
        asset: VAI,
        feed: "0x058316f8bb13acd442ee7a216c7b60cfb4ea1b53",
        maxStalePeriod: 864000,
      });

      await resilientOracle.setTokenConfig({
        asset: VAI,
        oracles: [chainlinkOracle.address, ethers.constants.AddressZero, ethers.constants.AddressZero],
        enableFlagsForOracles: [true, false, false],
      });

      const price = await resilientOracle.getUnderlyingPrice(VAI);
      expect(price).to.be.equal("967991030000000000");
    });

    it("validate USDC price", async () => {
      const vUSDCAddress = "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8";
      const USDCAddress = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

      // Configure price feed for USDC
      await chainlinkOracle.setTokenConfig({
        asset: USDCAddress,
        feed: "0x51597f405303C4377E36123cBc172b13269EA163",
        maxStalePeriod: 864000,
      });

      await resilientOracle.setTokenConfig({
        asset: USDCAddress,
        oracles: [chainlinkOracle.address, ethers.constants.AddressZero, ethers.constants.AddressZero],
        enableFlagsForOracles: [true, false, false],
      });

      const price = await resilientOracle.getUnderlyingPrice(vUSDCAddress);
      expect(price).to.be.equal("1000054860000000000");
    });
  }
});
