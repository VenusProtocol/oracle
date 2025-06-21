import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { xSolvBTC, SolvBTC, acm } = ADDRESSES[network.name];

  const redstoneOracle = await hre.ethers.getContract("RedStoneOracle");
  const resilientOracle = await hre.ethers.getContract("ResilientOracle");

  await deploy("xSolvBTCOneJumpRedStoneOracle", {
    contract: "OneJumpOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [xSolvBTC, SolvBTC, resilientOracle.address, redstoneOracle.address, 0, 0, 0, 0, acm, 0],
    skipIfAlreadyDeployed: true,
  });
};

func.skip = async () => hre.network.name !== "bscmainnet" && hre.network.name !== "bsctestnet";
func.tags = ["xSolvBTC"];
export default func;
