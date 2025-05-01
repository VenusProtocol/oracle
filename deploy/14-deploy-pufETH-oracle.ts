import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const proxyOwnerAddress = ADDRESSES[network.name].timelock;
  const { pufETH, WETH, acm } = ADDRESSES[network.name];

  const redStoneOracle = await hre.ethers.getContract("RedStoneOracle");
  const resilientOracle = await hre.ethers.getContract("ResilientOracle");

  await deploy("pufETHOneJumpRedStoneOracle", {
    contract: "OneJumpOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [pufETH, WETH, resilientOracle.address, redStoneOracle.address, 0, 0, 0, 0, acm, 0],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
    },
    skipIfAlreadyDeployed: true,
  });
};

func.skip = async () => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
func.tags = ["pufETHOneJumpRedStoneOracle"];
export default func;
