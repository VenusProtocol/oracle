import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { wUSDM, USDM, acm } = ADDRESSES[network.name];

  const SNAPSHOT_UPDATE_INTERVAL = ethers.constants.MaxUint256;
  const wUSDM_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.15", 18);
  const resilientOracle = await ethers.getContract("ResilientOracle");
  const block = await ethers.provider.getBlock("latest");
  const vault = await ethers.getContractAt("IERC4626", wUSDM);
  const exchangeRate = await vault.convertToAssets(parseUnits("1", 18));

  await deploy("wUSDM_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      wUSDM,
      USDM,
      resilientOracle.address,
      wUSDM_ANNUAL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      exchangeRate,
      block.timestamp,
      acm,
      0,
    ],
  });
};

func.tags = ["wUSDM"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "zksyncmainnet" && hre.network.name !== "zksyncsepolia";

export default func;
