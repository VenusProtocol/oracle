import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const oracle = await ethers.getContract("ResilientOracle");

  const { asBNB, slisBNB, acm } = ADDRESSES[network.name];

  const SNAPSHOT_UPDATE_INTERVAL = 0;
  const asBNB_ANNUAL_GROWTH_RATE = 0;
  const EXCHANGE_RATE = 0;
  const SNAPSHOT_TIMESTAMP = 0;
  const SNAPSHOT_GAP = 0;

  // Deploy dependencies for testnet
  if (network.name === "bsctestnet") {
    await deploy("MockAsBNBMinter", {
      from: deployer,
      contract: "MockAsBNBMinter",
      args: [],
      log: true,
      autoMine: true,
      skipIfAlreadyDeployed: true,
    });

    const minter = await ethers.getContract("MockAsBNBMinter");

    await deploy("MockAsBNB", {
      from: deployer,
      contract: "MockAsBNB",
      args: ["Astherus BNB", "asBNB", 18, minter.address],
      log: true,
      autoMine: true,
      skipIfAlreadyDeployed: true,
    });
  }

  await deploy("AsBNBOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      asBNB,
      slisBNB,
      oracle.address,
      asBNB_ANNUAL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      EXCHANGE_RATE,
      SNAPSHOT_TIMESTAMP,
      acm,
      SNAPSHOT_GAP,
    ],
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.tags = ["asBnbOracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "bsctestnet" && hre.network.name !== "bscmainnet";
