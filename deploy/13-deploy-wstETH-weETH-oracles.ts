import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const proxyOwnerAddress = ADDRESSES[network.name].timelock;
  const { WETH, wstETH, weETH } = ADDRESSES[network.name];

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");
  const chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");

  await deploy("wstETHOneJumpChainlinkOracle", {
    contract: "OneJumpOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [wstETH, WETH, resilientOracle.address, chainlinkOracle.address],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
    },
    skipIfAlreadyDeployed: true,
  });

  await deploy("weETHOneJumpChainlinkOracle", {
    contract: "OneJumpOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [weETH, WETH, resilientOracle.address, chainlinkOracle.address],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
    },
    skipIfAlreadyDeployed: true,
  });
};

func.skip = async () => hre.network.name !== "arbitrumone" && hre.network.name !== "arbitrumsepolia";
func.tags = ["wstETH_weETH_OneJumpOracles"];
export default func;
