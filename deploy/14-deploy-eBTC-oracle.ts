import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
  ADDRESSES,
  DAYS_30,
  SECONDS_PER_YEAR,
  getSnapshotGap,
  increaseExchangeRateByPercentage,
} from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const resilientOracle = await ethers.getContract("ResilientOracle");
  let { eBTC_Accountant } = ADDRESSES[network.name];
  const { WBTC, eBTC, acm } = ADDRESSES[network.name];

  eBTC_Accountant = eBTC_Accountant || (await ethers.getContract("MockAccountant_eBTC")).address;

  const eBTC_ANNUAL_GROWTH_RATE = SECONDS_PER_YEAR; // 0% growth rate
  const block = await ethers.provider.getBlock("latest");
  const accountant = await ethers.getContractAt("IAccountant", eBTC_Accountant);
  const exchangeRate = await accountant.getRateSafe();
  const snapshotGap = BigNumber.from("400"); // 4.00%

  await deploy("eBTCAccountantOracle", {
    contract: "EtherfiAccountantOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      eBTC_Accountant,
      eBTC,
      WBTC,
      resilientOracle.address,
      eBTC_ANNUAL_GROWTH_RATE,
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
func.tags = ["eBTCAccountantOracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
