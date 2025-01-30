import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

enum PendleRateKind {
  PT_TO_ASSET = 0,
  PT_TO_SY = 1,
}

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const oracle = await ethers.getContract("ResilientOracle");
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;
  const redStoneOracle = await ethers.getContract("RedStoneOracle");
  const resilientOracle = await ethers.getContract("ResilientOracle");
  const addresses = ADDRESSES[network.name];
  const ptOracleAddress = addresses.PTOracle || (await ethers.getContract("MockPendlePtOracle")).address;

  await deploy("SolvBTC.BBN_OneJumpRedStoneOracle", {
    contract: "OneJumpOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [addresses["SolvBTC.BBN"], addresses.BTCB, resilientOracle.address, redStoneOracle.address],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
    },
    skipIfAlreadyDeployed: true,
  });

  await deploy("PendleOracle-PT-SolvBTC.BBN-27MAR2025", {
    contract: "PendleOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      addresses["PT-SolvBTC.BBN-27MAR2025_Market"] || "0x0000000000000000000000000000000000000001",
      ptOracleAddress,
      PendleRateKind.PT_TO_SY,
      addresses["PT-SolvBTC.BBN-27MAR2025"],
      addresses["SolvBTC.BBN"],
      oracle.address,
      900,
    ],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
    },
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.tags = ["PT-SolvBTC.BBN"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "bsctestnet" && hre.network.name !== "bscmainnet";
