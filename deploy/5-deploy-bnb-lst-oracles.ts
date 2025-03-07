import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, assets } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const oracle = await ethers.getContract("ResilientOracle");

  const { ankrBNB, stkBNB, BNBx, BNBxStakeManager, slisBNBStakeManager, stkBNBStakePool, slisBNB, wBETH } =
    ADDRESSES[network.name];
  const ETH = assets[network.name].find(asset => asset.token === "ETH");
  const SNAPSHOT_UPDATE_INTERVAL = 24 * 60 * 60;

  // 1.1%
  const BNBx_ANNUL_GROWTH_RATE = ethers.utils.parseUnits("0.011", 18);
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
      BNBx_ANNUL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      exchangeRate,
      block.timestamp,
    ],
    skipIfAlreadyDeployed: true,
  });

  // 39.21%
  const slis_BNB_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.3921", 18);
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
    ],
    skipIfAlreadyDeployed: true,
  });

  // 2.3%
  const stk_BNB_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.023", 18);
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
    ],
    skipIfAlreadyDeployed: true,
  });

  const ankrBNBAddress = ankrBNB || (await ethers.getContract("MockAnkrBNB")).address;

  // 0.7%
  const ankr_BNB_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.007", 18);

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
    ],
    skipIfAlreadyDeployed: true,
  });

  const wBETHAddress = wBETH || (await ethers.getContract("MockWBETH")).address;

  // 2.79%
  const wBETH_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.0279", 18);
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
    ],
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.tags = ["bnb_lst"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "bscmainnet" && hre.network.name !== "bsctestnet";
