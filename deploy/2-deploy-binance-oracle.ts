import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const accessControlManagerAddress = ADDRESSES[network.name].acm;
  const proxyOwnerAddress = ADDRESSES[network.name].timelock;
  const timelock = ADDRESSES[network.name].timeloc;

  const { sidRegistryAddress, feedRegistryAddress } = ADDRESSES[network.name];

  // Skip if no sidRegistryAddress address in config
  if (sidRegistryAddress) {
    await deploy("BinanceOracle", {
      contract: "BinanceOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentProxy",
        execute: {
          methodName: "initialize",
          args: [sidRegistryAddress, accessControlManagerAddress],
        },
      },
    });
    const binanceOracle = await hre.ethers.getContract("BinanceOracle");
    const binanceOracleOwner = await binanceOracle.owner();

    if (sidRegistryAddress === "0x0000000000000000000000000000000000000000") {
      await binanceOracle.setFeedRegistryAddress(feedRegistryAddress);
    }

    if (binanceOracleOwner === deployer) {
      await binanceOracle.transferOwnership(timelock);
      console.log(`Ownership of BinanceOracle transfered from deployer to Timelock (${timelock})`);
    }
  }
};

func.tags = ["deploy-binance-oracle"];
func.skip = async env => !env.network.live;

export default func;
