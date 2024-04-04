import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, assets } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const resilientOracle = await ethers.getContract("ResilientOracle");
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;

  const { EtherFiLiquidityPool } = ADDRESSES[network.name];
  const weETH = assets[network.name].find(asset => asset.token === "weETH");
  const eETH = assets[network.name].find(asset => asset.token === "eETH");

  await deploy("BNBxOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [EtherFiLiquidityPool, weETH, eETH, resilientOracle.address],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
    },
  });
};

export default func;
func.tags = ["weETH"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
