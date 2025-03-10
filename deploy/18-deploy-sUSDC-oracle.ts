import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { sUSDS, USDS } = ADDRESSES[network.name];

  const SNAPSHOT_UPDATE_INTERVAL = 24 * 60 * 60;
  // 6.5%
  const sUSDe_ANNUL_GROWTH_RATE = ethers.utils.parseUnits("0.065", 18);
  const block = await ethers.provider.getBlock("latest");
  const vault = await ethers.getContractAt("IERC4626", sUSDS);
  const exchangeRate = await vault.convertToAssets(parseUnits("1", 18));
  const resilientOracle = await ethers.getContract("ResilientOracle");

  await deploy("sUSDS_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      sUSDS,
      USDS,
      resilientOracle.address,
      sUSDe_ANNUL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      exchangeRate,
      block.timestamp,
    ],
  });
};

func.tags = ["sUSDS"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";

export default func;
