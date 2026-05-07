import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;
  const defaultProxyAdmin = await hre.artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  const contractName = "ChainlinkOracle";

  await deploy("AtlasOracle", {
    contract: network.live ? contractName : "MockChainlinkOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    skipIfAlreadyDeployed: true,
    args: [],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [ADDRESSES[network.name].acm] : [],
      },
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
  });

  const atlasOracle = await hre.ethers.getContract("AtlasOracle");
  const atlasOracleOwner = await atlasOracle.owner();

  if (atlasOracleOwner === deployer && network.live) {
    await atlasOracle.transferOwnership(proxyOwnerAddress);
    console.log(`Ownership of AtlasOracle transferred from deployer to Timelock (${proxyOwnerAddress})`);
  }
};

func.tags = ["deploy-atlas"];
func.skip = async env => !env.network.live;
export default func;
