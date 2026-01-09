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

  await deploy("PendleOracle-PT-clisBNB-25JUN2026", {
    contract: "PendleOracle",
    args: [
      {
        market: addresses["PT-clisBNB-25JUN2026_Market"] || "0x0000000000000000000000000000000000000004",
        ptOracle: ptOracleAddress,
        rateKind: PendleRateKind.PT_TO_SY,
        ptToken: addresses["PT-clisBNB-25JUN2026"],
        underlyingToken: addresses.slisBNB,
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
    await deploy("PendleOracle-PT-clisBNB-25JUN2026_Reference_PtToAsset", {
      contract: "PendleOracle",
      args: [
        {
          market: addresses["PT-clisBNB-25JUN2026_Market"] || "0x0000000000000000000000000000000000000002",
          ptOracle: ptOracleAddress,
          rateKind: PendleRateKind.PT_TO_ASSET,
          ptToken: addresses["PT-clisBNB-25JUN2026"],
          underlyingToken: addresses.slisBNB,
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
  }
};

export default func;
func.tags = ["PT-clisBNB-2026"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "bsctestnet" && hre.network.name !== "bscmainnet";
