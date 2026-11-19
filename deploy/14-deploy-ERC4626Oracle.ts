import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { sUSDe, USDe, acm } = ADDRESSES[network.name];

  const SNAPSHOT_UPDATE_INTERVAL = 86400; // 24 hours
  const sUSDe_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.15", 18); // 15% annual
  const SNAPSHOT_GAP = parseUnits("0.01", 18); // 1% safety margin
  const resilientOracle = await ethers.getContract("ResilientOracle");
  const block = await ethers.provider.getBlock("latest");
  const vault = await ethers.getContractAt("IERC4626", sUSDe);
  const exchangeRate = await vault.convertToAssets(parseUnits("1", 18));

  await deploy("sUSDe_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      sUSDe,
      USDe,
      resilientOracle.address,
      sUSDe_ANNUAL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      exchangeRate,
      block.timestamp,
      acm,
      SNAPSHOT_GAP,
    ],
  });
};

func.tags = ["deploy-ERC4626-oracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";

export default func;
