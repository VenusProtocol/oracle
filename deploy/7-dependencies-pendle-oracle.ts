import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;

  await deploy("MockPendlePtOracle", {
    contract: "MockPendlePtOracle",
    from: deployer,
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
    skipIfAlreadyDeployed: true,
    args: [],
  });

  const pendleOracleContract = await ethers.getContract("MockPendlePtOracle");

  if ((await pendleOracleContract.owner()) === deployer) {
    await pendleOracleContract.transferOwnership(proxyOwnerAddress);
  }
};

export default func;
func.tags = ["pendle", "mock-pt-oracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "sepolia" && hre.network.name !== "bsctestnet";
