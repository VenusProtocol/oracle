import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { isMainnet } from "../helpers/deploymentUtils";

enum PendleRateKind {
  PT_TO_ASSET = 0,
  PT_TO_SY = 1,
}

type OracleConfig = {
  name: string;
  market: string;
  ptToken: string;
  underlyingToken: string;
  yieldToken: string;
  ptOracle: string;
  TWAPDuration: number;
  primaryRateKind: PendleRateKind;
}[];

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const oracle = await ethers.getContract("ResilientOracle");
  const addresses = ADDRESSES[network.name];
  const fallbackAddress = "0x0000000000000000000000000000000000000001";

  const deployOracles = async (oracleConfig: OracleConfig) => {
    await Promise.all(
      oracleConfig.map(
        async ({ name, market, ptToken, underlyingToken, yieldToken, ptOracle, TWAPDuration, primaryRateKind }) => {
          const ptOracleAddress = ptOracle || (await ethers.getContract("MockPendlePtOracle")).address;
          await deploy(name, {
            contract: "PendleOracle",
            from: deployer,
            log: true,
            deterministicDeployment: false,
            skipIfAlreadyDeployed: true,
            args: [
              {
                market: market || fallbackAddress,
                ptOracle: ptOracleAddress,
                rateKind: primaryRateKind,
                ptToken,
                underlyingToken: primaryRateKind === PendleRateKind.PT_TO_ASSET ? underlyingToken : yieldToken,
                resilientOracle: oracle.address,
                twapDuration: TWAPDuration,
                annualGrowthRate: 0,
                snapshotInterval: 0,
                initialSnapshotMaxExchangeRate: 0,
                initialSnapshotTimestamp: 0,
                accessControlManager: addresses.acm,
                snapshotGap: 0,
              },
            ],
          });
        },
      ),
    );
  };

  const deployReferenceOracles = async (oracleConfig: OracleConfig) => {
    const referenceOracle = await ethers.getContract("ReferenceOracle");
    for (const config of oracleConfig) {
      const { name, market, ptToken, underlyingToken, yieldToken, ptOracle, TWAPDuration, primaryRateKind } = config;
      const ptOracleAddress = ptOracle || (await ethers.getContract("MockPendlePtOracle")).address;
      const referenceRateKind =
        primaryRateKind === PendleRateKind.PT_TO_ASSET ? PendleRateKind.PT_TO_SY : PendleRateKind.PT_TO_ASSET;
      console.log("Deploying", `${name}_Reference`);
      await deploy(`${name}_Reference`, {
        contract: "PendleOracle",
        from: deployer,
        log: true,
        deterministicDeployment: false,
        skipIfAlreadyDeployed: true,
        args: [
          {
            market: market || fallbackAddress,
            ptOracle: ptOracleAddress,
            rateKind: referenceRateKind,
            ptToken,
            underlyingToken: referenceRateKind === PendleRateKind.PT_TO_ASSET ? underlyingToken : yieldToken,
            resilientOracle: referenceOracle.address,
            twapDuration: TWAPDuration,
            annualGrowthRate: 0,
            snapshotInterval: 0,
            initialSnapshotMaxExchangeRate: 0,
            initialSnapshotTimestamp: 0,
            accessControlManager: addresses.acm,
            snapshotGap: 0,
          },
        ],
      });
    }
  };

  const oracleConfig: OracleConfig = [
    {
      name: "PendleOracle-PT-weETH-26DEC2024",
      market: addresses.PTweETH_26DEC2024_Market,
      ptToken: addresses.PTweETH_26DEC2024,
      underlyingToken: addresses.WETH,
      yieldToken: addresses.weETH,
      ptOracle: addresses.PTOracle || (await ethers.getContract("MockPendlePtOracle")).address,
      TWAPDuration: 1800,
      primaryRateKind: PendleRateKind.PT_TO_ASSET,
    },
    {
      name: "PendleOracle_PT_USDe_27MAR2025",
      market: addresses.PTUSDe_27MAR2025_Market,
      ptToken: addresses.PTUSDe_27MAR2025,
      underlyingToken: addresses.USDe,
      yieldToken: addresses.USDe,
      ptOracle:
        network.name === "sepolia"
          ? (await ethers.getContract("MockPendleOracle_PT_USDe_27MAR2025")).address
          : addresses.PTOracle,
      TWAPDuration: 1800,
      primaryRateKind: PendleRateKind.PT_TO_ASSET,
    },
    {
      name: "PendleOracle_PT_sUSDe_27MAR2025",
      market: addresses.PTsUSDe_27MAR2025_Market,
      ptToken: addresses.PTsUSDe_27MAR2025,
      underlyingToken: addresses.USDe,
      yieldToken: addresses.sUSDe,
      ptOracle:
        network.name === "sepolia"
          ? (await ethers.getContract("MockPendleOracle_PT_sUSDe_27MAR2025")).address
          : addresses.PTOracle,
      TWAPDuration: 1800,
      primaryRateKind: PendleRateKind.PT_TO_ASSET,
    },
  ];

  await deployOracles(oracleConfig);
  if (isMainnet(network)) {
    console.log("Deploying reference oracles");
    await deployReferenceOracles(oracleConfig);
  }

  if (network.name === "sepolia") {
    const NormalTimelock = "0xc332F7D8D5eA72cf760ED0E1c0485c8891C6E0cF"; // SEPOLIA NORMAL TIMELOCK

    const mockContracts = ["MockPendleOracle_PT_USDe_27MAR2025", "MockPendleOracle_PT_sUSDe_27MAR2025"];

    await Promise.all(
      mockContracts.map(async mock => {
        const contract = await ethers.getContract(mock);
        if ((await contract.owner()) === deployer) {
          console.log(`Transferring ownership of ${contract.address} to ${NormalTimelock}`);
          const tx = await contract.transferOwnership(NormalTimelock);
          await tx.wait();
          console.log(`Ownership transferred to ${NormalTimelock}`);
        }
      }),
    );
  }
};

export default func;
func.tags = ["pendle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
