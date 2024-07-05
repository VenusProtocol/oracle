import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, assets } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const networkName: string = network.name === "hardhat" ? "bsctestnet" : network.name;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyOwnerAddress = network.live ? ADDRESSES[networkName].timelock : deployer;

  const { ankrBNB, wBETH } = ADDRESSES[networkName];

  if (!ankrBNB) {
    // deploy MockAnkrBNB
    await deploy("MockAnkrBNB", {
      from: deployer,
      log: true,
      autoMine: true,
      skipIfAlreadyDeployed: true,
      args: ["Ankr Staked BNB ", "ankrBNB", "18"],
    });

    const ankrBNBContract = await ethers.getContract("MockAnkrBNB");

    if ((await ankrBNBContract.owner()) === deployer) {
      await ankrBNBContract.transferOwnership(proxyOwnerAddress);
    }
  }

  if (!wBETH) {
    // deploy MockWBETH
    await deploy("MockWBETH", {
      from: deployer,
      log: true,
      autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
      skipIfAlreadyDeployed: true,
      args: ["Wrapped Binance Beacon ETH", "wBETH", "18"],
    });

    const wBETHContract = await ethers.getContract("MockWBETH");

    if ((await wBETHContract.owner()) === deployer) {
      await wBETHContract.transferOwnership(proxyOwnerAddress);
    }
  }
};

export default func;
func.tags = ["bnb_lst"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "bscmainnet" && hre.network.name !== "bsctestnet";
