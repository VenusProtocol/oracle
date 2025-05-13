import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const resilientOracle = await ethers.getContract("ResilientOracle");
  let { weETHs_Accountant } = ADDRESSES[network.name];
  const { weETHs, WETH, acm } = ADDRESSES[network.name];

  weETHs_Accountant = weETHs_Accountant || (await ethers.getContract("MockAccountant_weETHs")).address;

  const SNAPSHOT_UPDATE_INTERVAL = ethers.constants.MaxUint256;
  const weETHs_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.15", 18);
  const block = await ethers.provider.getBlock("latest");
  const vault = await ethers.getContractAt("IAccountant", weETHs_Accountant);
  const exchangeRate = await vault.getRateSafe();

  await deploy("WeETHAccountantOracle_weETHs", {
    contract: "WeETHAccountantOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      weETHs_Accountant,
      weETHs,
      WETH,
      resilientOracle.address,
      weETHs_ANNUAL_GROWTH_RATE,
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
func.tags = ["WeETHAccountantOracle_weETHs"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
