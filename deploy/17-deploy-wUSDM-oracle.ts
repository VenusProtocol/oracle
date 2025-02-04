import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { wUSDM, USDM } = ADDRESSES[network.name];

  const resilientOracle = await ethers.getContract("ResilientOracle");
  await deploy("wUSDM_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [wUSDM, USDM, resilientOracle.address],
  });
};

func.tags = ["wUSDM"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "zksyncmainnet" && hre.network.name !== "zksyncsepolia";

export default func;
