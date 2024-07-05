import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const networkName: string = network.name === "hardhat" ? "sepolia" : network.name;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyOwnerAddress = network.live ? ADDRESSES[networkName].timelock : deployer;

  let { EtherFiLiquidityPool } = ADDRESSES[networkName];

  if (!EtherFiLiquidityPool) {
    // deploy mock liquidity pool
    await deploy("MockEtherFiLiquidityPool", {
      from: deployer,
      contract: "MockEtherFiLiquidityPool",
      args: [],
      log: true,
      autoMine: true, 
      skipIfAlreadyDeployed: true,
    });

    const mockEtherFiLiquidityPool = await ethers.getContract("MockEtherFiLiquidityPool");
    EtherFiLiquidityPool = mockEtherFiLiquidityPool.address;
    await mockEtherFiLiquidityPool.transferOwnership(proxyOwnerAddress);
  }
};

export default func;
func.tags = ["weETH"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
