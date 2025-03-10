import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { WETH, wsuperOETHb } = ADDRESSES[network.name];

  const SNAPSHOT_UPDATE_INTERVAL = 24 * 60 * 60;
  // 6.06%
  const wsuperOETHb_ANNUL_GROWTH_RATE = ethers.utils.parseUnits("0.0606", 18);
  const block = await ethers.provider.getBlock("latest");
  const vault = await ethers.getContractAt("IERC4626", wsuperOETHb);
  const exchangeRate = await vault.convertToAssets(parseUnits("1", 18));
  const resilientOracle = await ethers.getContract("ResilientOracle");

  await deploy("wsuperOETHb_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      wsuperOETHb,
      WETH,
      resilientOracle.address,
      wsuperOETHb_ANNUL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      exchangeRate,
      block.timestamp,
    ],
  });
};

func.tags = ["wsuperOETHb"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "basemainnet" && hre.network.name !== "basesepolia";

export default func;
