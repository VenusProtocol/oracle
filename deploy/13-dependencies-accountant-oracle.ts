import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;

  await deploy("weETHsMockAccountantWithRateProviders", {
    from: deployer,
    contract: "MockAccountantWithRateProviders",
    args: [],
    log: true,
    autoMine: true,
    skipIfAlreadyDeployed: true,
  });

  const mockAccountantWithRateProviders = await ethers.getContract("weETHsMockAccountantWithRateProviders");
  await mockAccountantWithRateProviders.transferOwnership(proxyOwnerAddress);
};

export default func;
func.tags = ["accountant-oracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "sepolia";
