import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import hre, { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
  ADDRESSES,
  DAYS_30,
  SECONDS_PER_YEAR,
  getSnapshotGap,
  increaseExchangeRateByPercentage,
} from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { LBTC, WBTC, acm } = ADDRESSES[network.name];

  const redstoneOracle = await hre.ethers.getContract("RedStoneOracle");
  const resilientOracle = await hre.ethers.getContract("ResilientOracle");

  const LBTC_ANNUAL_GROWTH_RATE = SECONDS_PER_YEAR; // 0%
  const block = await ethers.provider.getBlock("latest");
  const exchangeRate = network.name === "ethereum" ? parseUnits("1", 8) : parseUnits("1.1", 8);
  const snapshotGap = BigNumber.from("400"); // 4.00%

  await deploy("LBTCOneJumpRedStoneOracle", {
    contract: "OneJumpOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      LBTC,
      WBTC,
      resilientOracle.address,
      redstoneOracle.address,
      LBTC_ANNUAL_GROWTH_RATE,
      DAYS_30,
      increaseExchangeRateByPercentage(exchangeRate, snapshotGap),
      block.timestamp,
      acm,
      getSnapshotGap(exchangeRate, snapshotGap.toNumber()),
    ],
    skipIfAlreadyDeployed: true,
  });
};

func.skip = async () => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
func.tags = ["LBTCOneJumpRedStoneOracle"];
export default func;
