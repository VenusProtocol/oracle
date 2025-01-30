import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { WETH, wsuperOETHb } = ADDRESSES[network.name];

  const resilientOracle = await ethers.getContract("ResilientOracle");
  await deploy("wsuperOETHb_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [wsuperOETHb, WETH, resilientOracle.address],
  });
};

func.tags = ["wsuperOETHb"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "basemainnet" && hre.network.name !== "basesepolia";

export default func;
