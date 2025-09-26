import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { isMainnet } from "../helpers/deploymentUtils";

enum PendleRateKind {
  PT_TO_ASSET = 0,
  PT_TO_SY = 1,
}

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const resilientOracle = await ethers.getContract("ResilientOracle");
  const addresses = ADDRESSES[network.name];
  const ptOracleAddress = addresses.PTOracle || (await ethers.getContract("MockPendlePtOracle")).address;

  const commonParams = {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    skipIfAlreadyDeployed: true,
    waitConfirmations: 1,
  };

  await deploy("PendleOracle-PT-USDe-30OCT2025", {
    contract: "PendleOracle",
    args: [
      {
        market: addresses["PT-USDe-30OCT2025_Market"] || "0x0000000000000000000000000000000000000003",
        ptOracle: ptOracleAddress,
        rateKind: PendleRateKind.PT_TO_SY,
        ptToken: addresses["PT-USDe-30OCT2025"],
        underlyingToken: addresses.USDe,
        resilientOracle: resilientOracle.address,
        twapDuration: 1800,
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
    await deploy("PendleOracle-PT-USDe-30OCT2025_Reference_PtToAsset", {
      contract: "PendleOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [
        {
          market: addresses["PT-USDe-30OCT2025_Market"] || "0x0000000000000000000000000000000000000003",
          ptOracle: ptOracleAddress,
          rateKind: PendleRateKind.PT_TO_ASSET,
          ptToken: addresses["PT-USDe-30OCT2025"],
          underlyingToken: addresses.USDe,
          resilientOracle: resilientOracle.address,
          twapDuration: 1800,
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
};

export default func;
func.tags = ["PT-USDe"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "bsctestnet" && hre.network.name !== "bscmainnet";
