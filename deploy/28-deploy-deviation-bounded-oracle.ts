import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  network,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const accessControlManagerAddress = ADDRESSES[network.name].acm;

  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;
  const vbnbAddress = ADDRESSES[network.name].vBNBAddress;
  const vaiAddress = ADDRESSES[network.name].VAIAddress;
  const timelock = ADDRESSES[network.name].timelock;

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");

  const defaultProxyAdmin = await hre.artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  await deploy("DeviationBoundedOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    skipIfAlreadyDeployed: true,
    args: [resilientOracle.address, vbnbAddress, vaiAddress],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      execute: {
        methodName: "initialize",
        args: [accessControlManagerAddress],
      },
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
  });

  const deviationBoundedOracle = await hre.ethers.getContract("DeviationBoundedOracle");
  const owner = await deviationBoundedOracle.owner();

  if (owner === deployer) {
    await deviationBoundedOracle.transferOwnership(timelock);
    console.log(`Ownership of DeviationBoundedOracle transferred from deployer to Timelock (${timelock})`);
  }
};

export default func;
func.tags = ["deploy-deviation-bounded-oracle"];
func.dependencies = ["deploy"];
