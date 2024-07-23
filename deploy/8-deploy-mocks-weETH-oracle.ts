import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;

  await deploy("MockEtherFiLiquidityPool", {
    from: deployer,
    contract: "MockEtherFiLiquidityPool",
    args: [],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
    skipIfAlreadyDeployed: true,
  });

  const mockEtherFiLiquidityPool = await ethers.getContract("MockEtherFiLiquidityPool");
  if ((await mockEtherFiLiquidityPool.owner()) !== deployer) {
    await mockEtherFiLiquidityPool.transferOwnership(proxyOwnerAddress);
  }
};

export default func;
func.tags = ["weETH"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "hardhat" && hre.network.name !== "sepolia";
