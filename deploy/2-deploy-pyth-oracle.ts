import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const accessControlManagerAddress = ADDRESSES[network.name].acm;
  const proxyOwnerAddress = ADDRESSES[network.name].timelock;
  const { timelock, pythOracleAddress } = ADDRESSES[network.name];

  // Skip if no pythOracle address in config
  if (pythOracleAddress) {
    await deploy("PythOracle", {
      contract: "PythOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentProxy",
        execute: {
          methodName: "initialize",
          args: [pythOracleAddress, accessControlManagerAddress],
        },
      },
    });

    const pythOracle = await hre.ethers.getContract("PythOracle");
    const pythOracleOwner = await pythOracle.owner();

    if (pythOracleOwner === deployer) {
      await pythOracle.transferOwnership(timelock);
      console.log(`Ownership of PythOracle transfered from deployer to Timelock (${timelock})`);
    }
  }
};
func.tags = ["deploy-pyth-oracle"];
func.skip = async env => !env.network.live;

export default func;
