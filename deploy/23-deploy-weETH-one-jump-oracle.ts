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
  const { WETH, weETH, acm } = ADDRESSES[network.name];

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");

  const redstoneOracle = await hre.ethers.getContract("RedStoneOracle");

  const commonParams = {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    waitConfirmations: 1,
  };

  await deploy("weETHOneJumpOracle", {
    contract: "OneJumpOracle",
    args: [weETH, WETH, resilientOracle.address, redstoneOracle.address, 0, 0, 0, 0, acm, 0],
    ...commonParams,
  });
};

func.skip = async () =>
  !["basemainnet", "basesepolia", "zksyncsepolia", "zksyncmainnet", "unichainsepolia", "unichainmainnet"].includes(
    hre.network.name,
  );
func.tags = ["weETH_OneJumpOracle"];
export default func;
