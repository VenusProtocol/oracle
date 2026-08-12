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

  await deploy("APROOracle", {
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

  const aproOracle = await hre.ethers.getContract("APROOracle");
  const aproOracleOwner = await aproOracle.owner();

  if (aproOracleOwner === deployer && network.live) {
    await aproOracle.transferOwnership(proxyOwnerAddress);
    console.log(`Ownership of APROOracle transferred from deployer to Timelock (${proxyOwnerAddress})`);
  }
};

func.tags = ["deploy-apro"];
func.skip = async env => !env.network.live;
export default func;
