import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const networkName: string = network.name === "hardhat" ? "sepolia" : network.name;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const resilientOracle = await ethers.getContract("ResilientOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  const proxyOwnerAddress = network.live ? ADDRESSES[networkName].timelock : deployer;

  let { EtherFiLiquidityPool } = ADDRESSES[networkName];
  const { weETH, eETH, WETH } = ADDRESSES[networkName];

  EtherFiLiquidityPool = EtherFiLiquidityPool || ( await ethers.getContract("MockEtherFiLiquidityPool")).address

  if (network.name === "sepolia") {
    await deploy("WeETHOracle", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [EtherFiLiquidityPool, weETH, eETH, resilientOracle.address],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentProxy",
      },
      skipIfAlreadyDeployed: true,
    });
  } else {
    await deploy("WeETHOracle_Equivalence", {
      contract: "WeETHOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [EtherFiLiquidityPool, weETH, WETH, resilientOracle.address],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentProxy",
      },
      skipIfAlreadyDeployed: true,
    });

    await deploy("WeETHOracle_NonEquivalence", {
      contract: "OneJumpOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [weETH, WETH, resilientOracle.address, chainlinkOracle.address],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentProxy",
      },
      skipIfAlreadyDeployed: true,
    });
  }
};

export default func;
func.tags = ["weETH"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
