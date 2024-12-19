import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { sUSDe, USDe } = ADDRESSES[network.name];

  const resilientOracle = await ethers.getContract("ResilientOracle");
  await deploy("sUSDe_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [sUSDe, USDe, resilientOracle.address],
  });
};

func.tags = ["deploy-ERC4626-oracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";

export default func;
