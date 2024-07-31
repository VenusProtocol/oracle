import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, SEQUENCER } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;

  const sequencer = SEQUENCER[network.name];
  let contractName = "ChainlinkOracle";
  if (sequencer !== undefined) contractName = "SequencerChainlinkOracle";

  await deploy("RedStoneOracle", {
    contract: network.live ? contractName : "MockChainlinkOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: sequencer ? [sequencer] : [],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [ADDRESSES[network.name].acm] : [],
      },
    },
  });

  const redStoneOracle = await hre.ethers.getContract("RedStoneOracle");
  const redStoneOracleOwner = await redStoneOracle.owner();

  if (redStoneOracleOwner === deployer && network.live) {
    await redStoneOracle.transferOwnership(proxyOwnerAddress);
    console.log(`Ownership of RedstoneOracle transfered from deployer to Timelock (${proxyOwnerAddress})`);
  }
};

func.tags = ["deploy-redstone"];
func.skip = async env => !env.network.live;
export default func;
