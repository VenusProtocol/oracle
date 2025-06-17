import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, addr0000, assets } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const { stETHAddress, wstETHAddress, acm } = ADDRESSES[network.name];
  const WETHAsset = assets[network.name].find(asset => asset.token === "WETH");
  const WETHAddress = WETHAsset?.address ?? addr0000;

  const oracle = await ethers.getContract("ResilientOracle");

  // Equivalence and NonEquivalence is related to if the oracle will
  // assume 1/1 price ration between stETH/ETH or
  // will get stETH/USD price from secondary market

  await deploy("WstETHOracle_Equivalence", {
    contract: "WstETHOracleV2",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [stETHAddress, wstETHAddress, WETHAddress, oracle.address, 0, 0, 0, 0, acm, 0],
  });

  await deploy("WstETHOracle_NonEquivalence", {
    contract: "WstETHOracleV2",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [stETHAddress, wstETHAddress, stETHAddress, oracle.address, 0, 0, 0, 0, acm, 0],
  });
};

export default func;
func.tags = ["wsteth"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
