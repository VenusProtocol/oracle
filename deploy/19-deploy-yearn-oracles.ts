import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, DAYS_30, getSnapshotGap, increaseExchangeRateByPercentage } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { WETH, USDC, USDT, USDS, yvUSDC_1, yvUSDT_1, yvUSDS_1, yvWETH_1, acm } = ADDRESSES[network.name];

  const resilientOracle = await ethers.getContract("ResilientOracle");

  const yvUSDC_1_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.1221", 18);
  const yvUSDT_1_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.1108", 18);
  const yvUSDS_1_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.2221", 18);
  const yvWETH_1_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.0518", 18);

  const yvUSDC_Snapshot_Gap = BigNumber.from("107"); // 1.07%
  const yvUSDT_Snapshot_Gap = BigNumber.from("92"); // 0.92%
  const yvUSDS_Snapshot_Gap = BigNumber.from("185"); // 1.85%
  const yvWETH_Snapshot_Gap = BigNumber.from("43"); // 0.43%

  let block = await ethers.provider.getBlock("latest");
  let vault = await ethers.getContractAt("IERC4626", yvUSDC_1);
  let exchangeRate = await vault.convertToAssets(ethers.utils.parseUnits("1", 6));

  await deploy("yvUSDC-1_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      yvUSDC_1,
      USDC,
      resilientOracle.address,
      yvUSDC_1_ANNUAL_GROWTH_RATE,
      DAYS_30,
      increaseExchangeRateByPercentage(exchangeRate, yvUSDC_Snapshot_Gap),
      block.timestamp,
      acm,
      getSnapshotGap(exchangeRate, yvUSDC_Snapshot_Gap.toNumber()),
    ],
  });

  block = await ethers.provider.getBlock("latest");
  vault = await ethers.getContractAt("IERC4626", yvUSDT_1);
  exchangeRate = await vault.convertToAssets(ethers.utils.parseUnits("1", 6));

  await deploy("yvUSDT-1_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      yvUSDT_1,
      USDT,
      resilientOracle.address,
      yvUSDT_1_ANNUAL_GROWTH_RATE,
      DAYS_30,
      increaseExchangeRateByPercentage(exchangeRate, yvUSDT_Snapshot_Gap),
      block.timestamp,
      acm,
      getSnapshotGap(exchangeRate, yvUSDT_Snapshot_Gap.toNumber()),
    ],
  });

  block = await ethers.provider.getBlock("latest");
  vault = await ethers.getContractAt("IERC4626", yvUSDS_1);
  exchangeRate = await vault.convertToAssets(ethers.utils.parseUnits("1", 18));

  await deploy("yvUSDS-1_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      yvUSDS_1,
      USDS,
      resilientOracle.address,
      yvUSDS_1_ANNUAL_GROWTH_RATE,
      DAYS_30,
      increaseExchangeRateByPercentage(exchangeRate, yvUSDS_Snapshot_Gap),
      block.timestamp,
      acm,
      getSnapshotGap(exchangeRate, yvUSDS_Snapshot_Gap.toNumber()),
    ],
  });

  block = await ethers.provider.getBlock("latest");
  vault = await ethers.getContractAt("IERC4626", yvWETH_1);
  exchangeRate = await vault.convertToAssets(ethers.utils.parseUnits("1", 18));

  await deploy("yvWETH-1_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      yvWETH_1,
      WETH,
      resilientOracle.address,
      yvWETH_1_ANNUAL_GROWTH_RATE,
      DAYS_30,
      increaseExchangeRateByPercentage(exchangeRate, yvWETH_Snapshot_Gap),
      block.timestamp,
      acm,
      getSnapshotGap(exchangeRate, yvWETH_Snapshot_Gap.toNumber()),
    ],
  });
};

func.tags = ["yearn"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";

export default func;
