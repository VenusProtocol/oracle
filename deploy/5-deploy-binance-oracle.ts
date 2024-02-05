import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BinanceOracle } from "typechain-types";

import { ADDRESSES } from "../helpers/deploymentConfig";

module.exports = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName: string = network.name === "hardhat" ? "bsctestnet" : network.name;
  const proxyOwnerAddress = network.live ? ADDRESSES[networkName].timelock : deployer;
  const { sidRegistryAddress, feedRegistryAddress } = ADDRESSES[networkName];
  let accessControlManager;
  if (!network.live) {
    await deploy("AccessControlManagerScenario", {
      from: deployer,
      args: [],
      log: true,
      autoMine: true,
    });

    accessControlManager = await hre.ethers.getContract("AccessControlManagerScenario");
  }
  const accessControlManagerAddress = network.live ? ADDRESSES[networkName].acm : accessControlManager?.address;

  await deploy("BinanceOracle_HAY_SnBNB", {
    contract: network.live ? "BinanceOracle" : "MockBinanceOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [sidRegistryAddress, accessControlManagerAddress] : [],
      },
    },
  });

  const binanceOracle: BinanceOracle = await hre.ethers.getContract("BinanceOracle_HAY_SnBNB");
  await binanceOracle.transferOwnership(ADDRESSES[networkName].timelock);
};

module.exports.tags = ["binanceOracle_HAY_SnBNB"];
