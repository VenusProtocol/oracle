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
  TokenSymbol: string;
  marketFallback: string;
  underlyingToken: string;
  TWAPDuration: number;
  primaryRateKind: PendleRateKind;
}[];

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const resilientOracle = await ethers.getContract("ResilientOracle");
  const addresses = ADDRESSES[network.name];
  const ptOracleAddress = addresses.PTOracle || (await ethers.getContract("MockPendlePtOracle")).address;

  const oracleConfig: OracleConfig = [
    {
      TokenSymbol: "PT-xSolvBTC-18DEC2025",
      marketFallback: "0x0000000000000000000000000000000000000005",
      underlyingToken: addresses.xSolvBTC,
      TWAPDuration: 1800,
      primaryRateKind: PendleRateKind.PT_TO_SY,
    },
    {
      TokenSymbol: "PT-SolvBTC.BNB-18DEC2025",
      marketFallback: "0x0000000000000000000000000000000000000006",
      underlyingToken: addresses["SolvBTC.BBN"],
      TWAPDuration: 1800,
      primaryRateKind: PendleRateKind.PT_TO_SY,
    },
  ];

  const commonParams = {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    skipIfAlreadyDeployed: true,
    waitConfirmations: 1,
  };

  for (const oracle of oracleConfig) {
    await deploy(`PendleOracle-${oracle.TokenSymbol}`, {
      contract: "PendleOracle",
      args: [
        {
          market: addresses[`${oracle.TokenSymbol}_Market`] || oracle.marketFallback,
          ptOracle: ptOracleAddress,
          rateKind: oracle.primaryRateKind,
          ptToken: addresses[oracle.TokenSymbol],
          underlyingToken: oracle.underlyingToken,
          resilientOracle: resilientOracle.address,
          twapDuration: oracle.TWAPDuration,
          annualGrowthRate: 0,
          snapshotInterval: 0,
          initialSnapshotMaxExchangeRate: 0,
          initialSnapshotTimestamp: 0,
          accessControlManager: addresses.acm,
          snapshotGap: 0,
        },
      ],
      ...commonParams,
    });

    if (isMainnet(network)) {
      const referenceRateKind =
        oracle.primaryRateKind === PendleRateKind.PT_TO_ASSET ? PendleRateKind.PT_TO_SY : PendleRateKind.PT_TO_ASSET;
      await deploy("PendleOracle-PT-USDe-30OCT2025_Reference_PtToAsset", {
        contract: "PendleOracle",
        from: deployer,
        log: true,
        deterministicDeployment: false,
        args: [
          {
            market: addresses[`${oracle.TokenSymbol}_Market`] || oracle.marketFallback,
            ptOracle: ptOracleAddress,
            rateKind: referenceRateKind,
            ptToken: addresses[oracle.TokenSymbol],
            underlyingToken: oracle.underlyingToken,
            resilientOracle: resilientOracle.address,
            twapDuration: oracle.TWAPDuration,
            annualGrowthRate: 0,
            snapshotInterval: 0,
            initialSnapshotMaxExchangeRate: 0,
            initialSnapshotTimestamp: 0,
            accessControlManager: addresses.acm,
            snapshotGap: 0,
          },
        ],
        skipIfAlreadyDeployed: true,
      });
    }
  }
};

export default func;
func.tags = ["PT-Oracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "bsctestnet" && hre.network.name !== "bscmainnet";
