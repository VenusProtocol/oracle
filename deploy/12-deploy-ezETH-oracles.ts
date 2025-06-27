import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { ezETH, WETH, acm } = ADDRESSES[network.name];

  const redStoneOracle = await hre.ethers.getContract("RedStoneOracle");
  const resilientOracle = await hre.ethers.getContract("ResilientOracle");
  const chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");

  await deploy("ezETHOneJumpRedStoneOracle", {
    contract: "OneJumpOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [ezETH, WETH, resilientOracle.address, redStoneOracle.address, 0, 0, 0, 0, acm, 0],
    skipIfAlreadyDeployed: true,
  });

  await deploy("ezETHOneJumpChainlinkOracle", {
    contract: "OneJumpOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [ezETH, WETH, resilientOracle.address, chainlinkOracle.address, 0, 0, 0, 0, acm, 0],
    skipIfAlreadyDeployed: true,
  });
};

func.skip = async () => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
func.tags = ["ezETHOneJumpOracles"];
export default func;
