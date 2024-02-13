import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, assets } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log(`Deployer ${deployer}`);

  const oracle = await ethers.getContract("ResilientOracle");
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;

  if (network.name === "bscmainnet" || network.name === "bsctestnet") {
    const { BNBx, BNBxStakeManager, slisBNBStakeManager, stkBNBStakePool } = ADDRESSES[network.name];
    const stkBNB = assets[network.name].find(asset => asset.token === "stkBNB");
    const slisBNB =
      network.name === "bscmainnet"
        ? "0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B"
        : "0xd2aF6A916Bc77764dc63742BC30f71AF4cF423F4";

    await deploy("BNBxOracle", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [BNBxStakeManager, BNBx, oracle.address],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentProxy",
      },
    });

    await deploy("SlisBNBOracle", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [slisBNBStakeManager, slisBNB, oracle.address],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentProxy",
      },
    });

    await deploy("StkBNBOracle", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [stkBNBStakePool, stkBNB?.address, oracle.address],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentProxy",
      },
    });
  }

  if (network.name === "bscmainnet") {
    const { wBETH } = ADDRESSES[network.name];
    const ETH = assets[network.name].find(asset => asset.token === "ETH");
    const ankrBNB = assets[network.name].find(asset => asset.token === "ankrBNB");

    await deploy("AnkrBNBOracle", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [ankrBNB?.address, oracle.address],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentProxy",
      },
    });

    await deploy("WBETHOracle", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [wBETH, ETH?.address, oracle.address],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentProxy",
      },
    });
  }
};

export default func;
func.tags = ["lst"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "bscmainnet" && hre.network.name !== "bsctestnet";
