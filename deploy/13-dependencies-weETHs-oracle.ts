import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;

  await deploy("MockAccountant_weETHs", {
    from: deployer,
    contract: "MockAccountant",
    args: [],
    log: true,
    autoMine: true,
    skipIfAlreadyDeployed: true,
  });

  const mockAccountant = await ethers.getContract("MockAccountant_weETHs");
  await mockAccountant.transferOwnership(proxyOwnerAddress);
};

export default func;
func.tags = ["WeETHAccountantOracle_weETHs"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "sepolia";
