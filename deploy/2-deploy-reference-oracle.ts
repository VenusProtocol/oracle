import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { skipAllExcept } from "../helpers/deploymentUtils";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const devMultisig = network.live ? ADDRESSES[network.name].devMultisig : deployer;
  const proxyAdminArtifact = await hre.artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");

  await deploy("ReferenceOracle", {
    contract: "ReferenceOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    skipIfAlreadyDeployed: true,
    args: [resilientOracle.address],
    proxy: {
      owner: devMultisig,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      execute: {
        methodName: "initialize",
        args: [],
      },
      viaAdminContract: {
        name: "DevProxyAdmin",
        artifact: proxyAdminArtifact,
      },
    },
  });

  const devProxyAdmin = await hre.ethers.getContract("DevProxyAdmin");
  const devProxyAdminOwner = await devProxyAdmin.owner();

  if (devProxyAdminOwner === deployer) {
    await devProxyAdmin.transferOwnership(devMultisig);
    console.log(`Ownership of DevProxyAdmin transfered from deployer to dev multisig (${devMultisig})`);
  }

  const referenceOracle = await hre.ethers.getContract("ReferenceOracle");
  const referenceOracleOwner = await referenceOracle.owner();

  if (referenceOracleOwner === deployer) {
    await referenceOracle.transferOwnership(devMultisig);
    console.log(`Ownership of ReferenceOracle transfered from deployer to dev multisig (${devMultisig})`);
  }
};

export default func;
func.skip = skipAllExcept(["bscmainnet", "ethereum"]);
func.tags = ["reference"];
