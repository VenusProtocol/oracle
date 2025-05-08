import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const oracle = await ethers.getContract("ResilientOracle");

  const { zkETH, WETH, acm } = ADDRESSES[network.name];
  const SNAPSHOT_UPDATE_INTERVAL = ethers.constants.MaxUint256;
  const zkETH_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.15", 18);
  const block = await ethers.provider.getBlock("latest");
  const vault = await ethers.getContractAt("IZkETH", zkETH);
  const exchangeRate = await vault.LSTPerToken();

  await deploy("ZkETHOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      zkETH,
      WETH,
      oracle.address,
      zkETH_ANNUAL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      exchangeRate,
      block.timestamp,
      acm,
      0,
    ],
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.tags = ["zkETH"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "zksyncmainnet" && hre.network.name !== "zksyncsepolia";
