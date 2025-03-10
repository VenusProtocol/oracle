import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { WETH, USDC, USDT, USDS, yvUSDC_1, yvUSDT_1, yvUSDS_1, yvWETH_1 } = ADDRESSES[network.name];

  const resilientOracle = await ethers.getContract("ResilientOracle");

  const SNAPSHOT_UPDATE_INTERVAL = 24 * 60 * 60;
  const yvUSDC_1_ANNUL_GROWTH_RATE = ethers.utils.parseUnits("0.082", 18);
  const yvUSDT_1_ANNUL_GROWTH_RATE = ethers.utils.parseUnits("0.0732", 18);
  const yvUSDS_1_ANNUL_GROWTH_RATE = ethers.utils.parseUnits("0.0382", 18);
  const yvWETH_1_ANNUL_GROWTH_RATE = ethers.utils.parseUnits("0.0239", 18);

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
      yvUSDC_1_ANNUL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      exchangeRate,
      block.timestamp,
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
      yvUSDT_1_ANNUL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      exchangeRate,
      block.timestamp,
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
      yvUSDS_1_ANNUL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      exchangeRate,
      block.timestamp,
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
      yvWETH_1_ANNUL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      exchangeRate,
      block.timestamp,
    ],
  });
};

func.tags = ["yearn"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";

export default func;
