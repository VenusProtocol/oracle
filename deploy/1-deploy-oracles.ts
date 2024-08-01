import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, SEQUENCER } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({
  getChainId,
  getNamedAccounts,
  deployments,
  network,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

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

  let vai;
  if (!network.live) {
    await deploy("VAIScenario", {
      from: deployer,
      log: true,
      autoMine: true,
      args: [await getChainId()],
    });

    vai = await hre.ethers.getContract("VAIScenario");
  }
  const accessControlManagerAddress = network.live ? ADDRESSES[network.name].acm : accessControlManager?.address;
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;
  const vaiAddress = network.live ? ADDRESSES[network.name].VAI : vai?.address;
  const vbnbAddress = network.live ? ADDRESSES[network.name].vBNB : deployer;
  const timelock = network.live ? ADDRESSES[network.name].timelock : deployer;

  const defaultProxyAdmin = await hre.artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  await deploy("BoundValidator", {
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
        args: [accessControlManagerAddress],
      },
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
  });

  const boundValidator = await hre.ethers.getContract("BoundValidator");

  await deploy("ResilientOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    skipIfAlreadyDeployed: true,
    args: [vbnbAddress, vaiAddress, boundValidator.address],
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

  const sequencer = SEQUENCER[network.name];
  let contractName = "ChainlinkOracle";
  if (sequencer !== undefined) contractName = "SequencerChainlinkOracle";

  await deploy(contractName, {
    contract: network.live ? contractName : "MockChainlinkOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    skipIfAlreadyDeployed: true,
    args: sequencer ? [sequencer] : [],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [accessControlManagerAddress] : [],
      },
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
  });

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");
  const chainlinkOracle = await hre.ethers.getContract(contractName);

  await accessControlManager?.giveCallPermission(chainlinkOracle.address, "setTokenConfig(TokenConfig)", deployer);
  await accessControlManager?.giveCallPermission(resilientOracle.address, "setTokenConfig(TokenConfig)", deployer);

  const resilientOracleOwner = await resilientOracle.owner();
  const chainlinkOracleOwner = await chainlinkOracle.owner();
  const boundValidatorOwner = await boundValidator.owner();

  if (resilientOracleOwner === deployer) {
    await resilientOracle.transferOwnership(timelock);
    console.log(`Ownership of ResilientOracle transfered from deployer to Timelock (${timelock})`);
  }

  if (chainlinkOracleOwner === deployer) {
    await chainlinkOracle.transferOwnership(timelock);
    console.log(`Ownership of ChainlinkOracle transfered from deployer to Timelock (${timelock})`);
  }

  if (boundValidatorOwner === deployer) {
    await boundValidator.transferOwnership(timelock);
    console.log(`Ownership of BoundValidator transfered from deployer to Timelock (${timelock})`);
  }
};

export default func;
func.tags = ["deploy"];
