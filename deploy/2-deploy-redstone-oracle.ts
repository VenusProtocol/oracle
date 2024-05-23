import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const ARBITRUM_SEQUENCER = "0xFdB631F5EE196F0ed6FAa767959853A9F217697D";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;

  console.log(`Timelock (${proxyOwnerAddress})`);

  if (network.name === "arbitrumone") {
    await deploy("RedStoneOracle", {
      contract: "SequencerChainlinkOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [ARBITRUM_SEQUENCER],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentProxy",
        execute: {
          methodName: "initialize",
          args: network.live ? [ADDRESSES[network.name].acm] : [],
        },
      },
    });
  } else {
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
          args: network.live ? [ADDRESSES[network.name].acm] : [],
        },
      },
    });
  }

  const redStoneOracle = await hre.ethers.getContract("RedStoneOracle");
  const redStoneOracleOwner = await redStoneOracle.owner();

  if (redStoneOracleOwner === deployer && network.live) {
    await redStoneOracle.transferOwnership(proxyOwnerAddress);
    console.log(`Ownership of RedstoneOracle transfered from deployer to Timelock (${proxyOwnerAddress})`);
  }
};

func.skip = async ({ network }: HardhatRuntimeEnvironment) =>
  !["hardhat", "bscmainnet", "bsctestnet", "sepolia", "ethereum", "arbitrumone"].includes(network.name);
func.tags = ["deploy-redstone"];
export default func;
