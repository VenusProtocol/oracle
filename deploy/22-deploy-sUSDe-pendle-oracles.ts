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

  const redStoneOracle = await ethers.getContract("RedStoneOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
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

  await deploy("sUSDeOneJumpChainlinkOracle", {
    contract: "OneJumpOracle",
    args: [
      addresses.sUSDe,
      addresses.USDe,
      resilientOracle.address,
      chainlinkOracle.address,
      0,
      0,
      0,
      0,
      addresses.acm,
      0,
    ],
    ...commonParams,
  });

  await deploy("sUSDeOneJumpRedstoneOracle", {
    contract: "OneJumpOracle",
    args: [
      addresses.sUSDe,
      addresses.USDe,
      resilientOracle.address,
      redStoneOracle.address,
      0,
      0,
      0,
      0,
      addresses.acm,
      0,
    ],
    ...commonParams,
  });

  await deploy("PendleOracle-PT-sUSDe-26JUN2025", {
    contract: "PendleOracle",
    args: [
      {
        market: addresses["PT-sUSDE-26JUN2025_Market"] || "0x0000000000000000000000000000000000000003",
        ptOracle: ptOracleAddress,
        rateKind: PendleRateKind.PT_TO_SY,
        ptToken: addresses["PT-sUSDE-26JUN2025"],
        underlyingToken: addresses.sUSDe,
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
    await deploy("PendleOracle-PT-sUSDe-26JUN2025_Reference_PtToAsset", {
      contract: "PendleOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [
        {
          market: addresses["PT-sUSDE-26JUN2025_Market"] || "0x0000000000000000000000000000000000000003",
          ptOracle: ptOracleAddress,
          rateKind: PendleRateKind.PT_TO_ASSET,
          ptToken: addresses["PT-sUSDE-26JUN2025"],
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
func.tags = ["PT-sUSDe"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "bsctestnet" && hre.network.name !== "bscmainnet";
