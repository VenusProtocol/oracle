import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, DAYS_30, getSnapshotGap, increaseExchangeRateByPercentage } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const oracle = await ethers.getContract("ResilientOracle");

  const { sFRAX, FRAX, acm } = ADDRESSES[network.name];

  const sFRAX_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.5404", 18); // 54.04%
  const block = await ethers.provider.getBlock("latest");
  const vault = await ethers.getContractAt("ISFrax", sFRAX || (await ethers.getContract("MockSFrax")).address);
  const exchangeRate = await vault.convertToAssets(parseUnits("1", 18));
  const snapshotGap = BigNumber.from("450"); // 4.5%

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
      DAYS_30,
      increaseExchangeRateByPercentage(exchangeRate, snapshotGap),
      block.timestamp,
      acm,
      getSnapshotGap(exchangeRate, snapshotGap.toNumber()),
    ],
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.tags = ["sFraxOracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
