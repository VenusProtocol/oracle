import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, assets } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const oracle = await ethers.getContract("ResilientOracle");

  const { ankrBNB, stkBNB, BNBx, BNBxStakeManager, slisBNBStakeManager, stkBNBStakePool, slisBNB, wBETH, acm } =
    ADDRESSES[network.name];
  const ETH = assets[network.name].find(asset => asset.token === "ETH");

  const SNAPSHOT_UPDATE_INTERVAL = 0;
  const BNBx_ANNUAL_GROWTH_RATE = 0;
  const slis_BNB_ANNUAL_GROWTH_RATE = 0;
  const ankr_BNB_ANNUAL_GROWTH_RATE = 0;
  const EXCHANGE_RATE = 0;
  const SNAPSHOT_TIMESTAMP = 0;
  const SNAPSHOT_GAP = 0;

  let block = await ethers.provider.getBlock("latest");

  await deploy("BNBxOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      BNBxStakeManager,
      BNBx,
      oracle.address,
      BNBx_ANNUAL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      EXCHANGE_RATE,
      SNAPSHOT_TIMESTAMP,
      acm,
      SNAPSHOT_GAP,
    ],
    skipIfAlreadyDeployed: true,
  });

  await deploy("SlisBNBOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      slisBNBStakeManager,
      slisBNB,
      oracle.address,
      slis_BNB_ANNUAL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      EXCHANGE_RATE,
      SNAPSHOT_TIMESTAMP,
      acm,
      SNAPSHOT_GAP,
    ],
    skipIfAlreadyDeployed: true,
  });

  const stk_BNB_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.15", 18);
  block = await ethers.provider.getBlock("latest");
  const stakePoolContract = await ethers.getContractAt("IPStakePool", stkBNBStakePool);
  const exchangeRateData = await stakePoolContract.exchangeRate();
  exchangeRate = exchangeRateData.totalWei.mul(ethers.utils.parseUnits("1", 18)).div(exchangeRateData.poolTokenSupply);

  await deploy("StkBNBOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      stkBNBStakePool,
      stkBNB,
      oracle.address,
      stk_BNB_ANNUAL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      exchangeRate,
      block.timestamp,
      acm,
      0,
    ],
    skipIfAlreadyDeployed: true,
  });

  const ankrBNBAddress = ankrBNB || (await ethers.getContract("MockAnkrBNB")).address;

  await deploy("AnkrBNBOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      ankrBNBAddress,
      oracle.address,
      ankr_BNB_ANNUAL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      EXCHANGE_RATE,
      SNAPSHOT_TIMESTAMP,
      acm,
      SNAPSHOT_GAP,
    ],
    skipIfAlreadyDeployed: true,
  });

  const wBETHAddress = wBETH || (await ethers.getContract("MockWBETH")).address;

  const wBETH_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.15", 18);
  block = await ethers.provider.getBlock("latest");
  const wBETHContract = await ethers.getContractAt("IWBETH", wBETHAddress);
  exchangeRate = await wBETHContract.exchangeRate();

  await deploy("WBETHOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      wBETHAddress,
      ETH?.address,
      oracle.address,
      wBETH_ANNUAL_GROWTH_RATE,
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
func.tags = ["bnb_lst"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "bscmainnet" && hre.network.name !== "bsctestnet";
