import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const { stETHAddress, wstETHAddress, WETH, acm } = ADDRESSES[network.name];

  const oracle = await ethers.getContract("ResilientOracle");

  await deploy("WstETHOracleV2_Equivalence", {
    contract: "WstETHOracleV2",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [wstETHAddress, WETH, oracle.address, 0, 0, 0, 0, acm, 0],
  });

  await deploy("WstETHOracleV2_NonEquivalence", {
    contract: "WstETHOracleV2",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [wstETHAddress, stETHAddress, oracle.address, 0, 0, 0, 0, acm, 0],
  });
};

export default func;
func.tags = ["wsteth"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
