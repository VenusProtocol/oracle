import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  if (!deployer) {
    throw new Error("Deployer address is not defined. Ensure deployer is set in namedAccounts.");
  }
  const { WETH, wstETH, acm } = ADDRESSES[network.name];

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");

  const chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");

  const commonParams = {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    waitConfirmations: 1,
  };

  await deploy("wstETHOneJumpChainlinkOracle", {
    contract: "OneJumpOracle",
    args: [wstETH, WETH, resilientOracle.address, chainlinkOracle.address, 0, 0, 0, 0, acm, 0],
    ...commonParams,
  });
};

func.skip = async () => !["basemainnet", "basesepolia", "zksyncsepolia", "zksyncmainnet"].includes(hre.network.name);
func.tags = ["wstETH_OneJumpOracle"];
export default func;
