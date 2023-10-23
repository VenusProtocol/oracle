import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../utils/deploymentUtils";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const networkName = network.name === "bscmainnet" ? "bscmainnet" : "bsctestnet";
  const proxyOwnerAddress = network.live ? ADDRESSES[networkName].timelock : deployer;

  await deploy("RedStoneOracle", {
    contract: network.live ? "ChainlinkOracle" : "MockChainlinkOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [ADDRESSES[networkName].acm] : [],
      },
    },
  });

  const redStoneOracle = await hre.ethers.getContract("RedStoneOracle");
  const redStoneOracleOwner = await redStoneOracle.owner();

  if (redStoneOracleOwner === deployer) {
    await redStoneOracle.transferOwnership(ADDRESSES[networkName].timelock);
  }
};

func.tags = ["deploy-redstone"];
export default func;
