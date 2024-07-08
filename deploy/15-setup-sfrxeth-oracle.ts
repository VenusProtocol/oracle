import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, network }: HardhatRuntimeEnvironment) => {
  const { deployer } = await getNamedAccounts();

  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;

  const sfrxETHOracle = await ethers.getContract("SFrxETHOracle");

  if ((await sfrxETHOracle.owner()) === deployer) {
    await sfrxETHOracle.transferOwnership(proxyOwnerAddress);
  }
};

export default func;
func.id = "sFraxETHOracle-setup";
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum";
