import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const oracle = await ethers.getContract("ResilientOracle");

  const { sFRAX, FRAX, acm } = ADDRESSES[network.name];

  const SNAPSHOT_UPDATE_INTERVAL = ethers.constants.MaxUint256;
  const sFRAX_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.15", 18);
  const block = await ethers.provider.getBlock("latest");
  const vault = await ethers.getContractAt("ISFrax", sFRAX || (await ethers.getContract("MockSFrax")).address);
  const exchangeRate = await vault.convertToAssets(parseUnits("1", 18));

  await deploy("SFraxOracle", {
    contract: "SFraxOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      sFRAX || (await ethers.getContract("MockSFrax")).address,
      FRAX,
      oracle.address,
      sFRAX_ANNUAL_GROWTH_RATE,
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
func.tags = ["sFraxOracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
