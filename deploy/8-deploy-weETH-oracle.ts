import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const resilientOracle = await ethers.getContract("ResilientOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  let { EtherFiLiquidityPool } = ADDRESSES[network.name];
  const { weETH, eETH, WETH, acm } = ADDRESSES[network.name];

  EtherFiLiquidityPool = EtherFiLiquidityPool || (await ethers.getContract("MockEtherFiLiquidityPool")).address;

  // const SNAPSHOT_UPDATE_INTERVAL = ethers.constants.MaxUint256;
  // const weETH_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.15", 18);
  // const block = await ethers.provider.getBlock("latest");
  // const vault = await ethers.getContractAt("IEtherFiLiquidityPool", EtherFiLiquidityPool);
  // const exchangeRate = await vault.amountForShare(parseUnits("1", 18));

  if (network.name === "sepolia") {
    await deploy("WeETHOracle", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [EtherFiLiquidityPool, weETH, eETH, resilientOracle.address, 0, 0, 0, 0, acm, 0],
      skipIfAlreadyDeployed: true,
    });
  } else {
    await deploy("WeETHOracle_Equivalence", {
      contract: "WeETHOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [EtherFiLiquidityPool, weETH, WETH, resilientOracle.address, 0, 0, 0, 0, acm, 0],
      skipIfAlreadyDeployed: true,
    });

    await deploy("WeETHOracle_NonEquivalence", {
      contract: "OneJumpOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [weETH, WETH, resilientOracle.address, chainlinkOracle.address, 0, 0, 0, 0, acm, 0],
      skipIfAlreadyDeployed: true,
    });
  }
};

export default func;
func.tags = ["weETH"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
