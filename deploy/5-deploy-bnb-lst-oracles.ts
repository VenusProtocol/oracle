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
  const SNAPSHOT_UPDATE_INTERVAL = ethers.constants.MaxUint256;

  const BNBx_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.15", 18);
  let block = await ethers.provider.getBlock("latest");
  const stakeManagerContract = await ethers.getContractAt("IStaderStakeManager", BNBxStakeManager);
  let exchangeRate = await stakeManagerContract.convertBnbXToBnb(ethers.utils.parseUnits("1", 18));

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
      exchangeRate,
      block.timestamp,
      acm,
      0,
    ],
    skipIfAlreadyDeployed: true,
  });

  const slis_BNB_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.15", 18);
  block = await ethers.provider.getBlock("latest");
  const syncClubStakeManagerContract = await ethers.getContractAt("ISynclubStakeManager", slisBNBStakeManager);
  exchangeRate = await syncClubStakeManagerContract.convertSnBnbToBnb(ethers.utils.parseUnits("1", 18));

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
      exchangeRate,
      block.timestamp,
      acm,
      0,
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

  const ankr_BNB_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.15", 18);

  block = await ethers.provider.getBlock("latest");
  const ankrBNBContract = await ethers.getContractAt("IAnkrBNB", ankrBNBAddress);
  exchangeRate = await ankrBNBContract.sharesToBonds(ethers.utils.parseUnits("1", 18));

  await deploy("AnkrBNBOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      ankrBNBAddress,
      oracle.address,
      ankr_BNB_ANNUAL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      exchangeRate,
      block.timestamp,
      acm,
      0,
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
