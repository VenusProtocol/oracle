import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber, Wallet } from "ethers";
import { ethers, upgrades } from "hardhat";
import { BinanceOracle, BinanceOracle__factory, BoundValidator, BoundValidator__factory, ChainlinkOracle, ChainlinkOracle__factory, PythOracle, PythOracle__factory, ResilientOracle, ResilientOracle__factory, TwapOracle, TwapOracle__factory } from "../../typechain-types";

const FORK_MAINNET = process.env.FORK_MAINNET === "true";
const vBNB = "0xA07c5b74C9B40447a954e1466938b865b6BBea36";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const PythOracleAddress = "0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594";
const SIDRegistryAddress = "0x08CEd32a7f3eeC915Ba84415e9C07a7286977956";
const BNBAddress = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"

interface OracleFixture {
  resillientOracle: ResilientOracle;
  boundValidator: BoundValidator;
  chainlinkOracle: ChainlinkOracle;
  twapOracle: TwapOracle;
  pythOracle: PythOracle;
  binanceOracle: BinanceOracle;
}

describe("XVSVault", async () => {
  let deployer: Wallet;
  let resillientOracle: ResilientOracle;
  let chainlinkOracle: ChainlinkOracle;

  before("get signers", async () => {
    [deployer] = await (ethers as any).getSigners();
  });

  if (FORK_MAINNET) {
    async function deployOracleFixture(): Promise<OracleFixture> {
      const BoundValidatorFactory:BoundValidator__factory = await ethers.getContractFactory("BoundValidator");
      const boundValidator = <BoundValidator>await upgrades.deployProxy(
        BoundValidatorFactory,
        [],
        {
          constructorArgs: [vBNB],
        },
      );

      const ResilientOracleFactory:ResilientOracle__factory = await ethers.getContractFactory("ResilientOracle");
      const resillientOracle = <ResilientOracle>await upgrades.deployProxy(
        ResilientOracleFactory,
        [boundValidator.address],
        {
          constructorArgs: [vBNB],
        },
      );

      const ChainlinkOracleFactory:ChainlinkOracle__factory = await ethers.getContractFactory("ChainlinkOracle");
      const chainlinkOracle = <ChainlinkOracle>await upgrades.deployProxy(
        ChainlinkOracleFactory,
        [],
        {
          constructorArgs: [vBNB],
        },
      );

      const TwapOracleFactory:TwapOracle__factory = await ethers.getContractFactory("TwapOracle");
      const twapOracle = <TwapOracle>await upgrades.deployProxy(
        TwapOracleFactory,
        [],
        {
          constructorArgs: [vBNB, WBNB],
        },
      );

      const PythOracleFactory:PythOracle__factory = await ethers.getContractFactory("PythOracle");
      const pythOracle = <PythOracle>await upgrades.deployProxy(
        PythOracleFactory,
        [PythOracleAddress],
        {
          constructorArgs: [vBNB],
        },
      );

      const BinanceOracleFactory:BinanceOracle__factory = await ethers.getContractFactory("BinanceOracle");
      const binanceOracle = <BinanceOracle>await upgrades.deployProxy(
        BinanceOracleFactory,
        [SIDRegistryAddress],
        {
          constructorArgs: [vBNB],
        },
      );
      
      return { resillientOracle, boundValidator, chainlinkOracle, twapOracle, pythOracle, binanceOracle };
    }
  
    beforeEach("deploy and configure XVSVault contracts", async () => {
      ({ resillientOracle, chainlinkOracle } = await loadFixture(deployOracleFixture));     

      //Configure price feed for vBNB
      await chainlinkOracle.setTokenConfig({
        asset: BNBAddress,
        feed: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
        maxStalePeriod: 86400
      })

      await resillientOracle.setTokenConfig({
        asset: BNBAddress,
        oracles: [
          chainlinkOracle.address, 
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
        ],
        enableFlagsForOracles: [true, false, false]
      })
    });
  
    it("check vBNB price", async () => {
      const price = await resillientOracle.getUnderlyingPrice(vBNB)
      expect(price).to.be.equal("274310000000000000000")
    });
  }
})