import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
  ADDRESSES,
  DAYS_30,
  addr0000,
  assets,
  getSnapshotGap,
  increaseExchangeRateByPercentage,
} from "../helpers/deploymentConfig";

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

  const wstETH_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.067", 18); // 6.7%
  const block = await ethers.provider.getBlock("latest");
  const stETHContract = await ethers.getContractAt("IStETH", stETHAddress);
  const exchangeRate = await stETHContract.getPooledEthByShares(parseUnits("1", 18));
  const snapshotGap = BigNumber.from("55"); // 0.55%

  if (network.name === "ethereum") {
    await deploy("WstETHOracle_Equivalence", {
      contract: "WstETHOracleV2",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [
        stETHAddress,
        wstETHAddress,
        WETHAddress,
        oracle.address,
        wstETH_ANNUAL_GROWTH_RATE,
        DAYS_30,
        increaseExchangeRateByPercentage(exchangeRate, snapshotGap),
        block.timestamp,
        acm,
        getSnapshotGap(exchangeRate, snapshotGap.toNumber()),
      ],
    });

    await deploy("WstETHOracle_NonEquivalence", {
      contract: "WstETHOracleV2",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [
        stETHAddress,
        wstETHAddress,
        stETHAddress,
        oracle.address,
        wstETH_ANNUAL_GROWTH_RATE,
        DAYS_30,
        increaseExchangeRateByPercentage(exchangeRate, snapshotGap),
        block.timestamp,
        acm,
        getSnapshotGap(exchangeRate, snapshotGap.toNumber()),
      ],
    });
  } else {
    await deploy("WstETHOracle", {
      contract: "WstETHOracleV2",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [
        stETHAddress,
        wstETHAddress,
        WETHAddress,
        oracle.address,
        wstETH_ANNUAL_GROWTH_RATE,
        DAYS_30,
        increaseExchangeRateByPercentage(exchangeRate, snapshotGap),
        block.timestamp,
        acm,
        getSnapshotGap(exchangeRate, snapshotGap.toNumber()),
      ],
    });
  }
};

export default func;
func.tags = ["wsteth"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
