import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, SEQUENCER } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName: string = network.name === "hardhat" ? "bsctestnet" : network.name;

  console.log(`Timelock: ${ADDRESSES[networkName].timelock}`);

  const { vBNBAddress } = ADDRESSES[networkName];
  const { VAIAddress } = ADDRESSES[networkName];

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
  const proxyOwnerAddress = network.live ? ADDRESSES[networkName].timelock : deployer;

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
  console.log(boundValidator.address);

  await deploy("ResilientOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    skipIfAlreadyDeployed: true,
    args: [vBNBAddress, VAIAddress, boundValidator.address],
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

  const { pythOracleAddress } = ADDRESSES[networkName];

  // Skip if no pythOracle address in config
  if (pythOracleAddress) {
    await deploy("PythOracle", {
      contract: network.live ? "PythOracle" : "MockPythOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentUpgradeableProxy",
        execute: {
          methodName: "initialize",
          args: network.live ? [pythOracleAddress, accessControlManagerAddress] : [pythOracleAddress],
        },
        viaAdminContract: {
          name: "DefaultProxyAdmin",
          artifact: defaultProxyAdmin,
        },
      },
    });

    const pythOracle = await hre.ethers.getContract("PythOracle");
    await accessControlManager?.giveCallPermission(pythOracle.address, "setTokenConfig(TokenConfig)", deployer);
    const pythOracleOwner = await pythOracle.owner();

    if (pythOracleOwner === deployer) {
      await pythOracle.transferOwnership(ADDRESSES[networkName].timelock);
      console.log(`Ownership of PythOracle transfered from deployer to Timelock (${ADDRESSES[networkName].timelock})`);
    }
  }

  const { sidRegistryAddress, feedRegistryAddress } = ADDRESSES[networkName];
  // Skip if no sidRegistryAddress address in config
  if (sidRegistryAddress) {
    await deploy("BinanceOracle", {
      contract: network.live ? "BinanceOracle" : "MockBinanceOracle",
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
          args: network.live ? [sidRegistryAddress, accessControlManagerAddress] : [],
        },
        viaAdminContract: {
          name: "DefaultProxyAdmin",
          artifact: defaultProxyAdmin,
        },
      },
    });
    const binanceOracle = await hre.ethers.getContract("BinanceOracle");
    const binanceOracleOwner = await binanceOracle.owner();

    if (network.live && sidRegistryAddress === "0x0000000000000000000000000000000000000000") {
      await binanceOracle.setFeedRegistryAddress(feedRegistryAddress);
    }

    if (binanceOracleOwner === deployer) {
      await binanceOracle.transferOwnership(ADDRESSES[networkName].timelock);
      console.log(
        `Ownership of BinanceOracle transfered from deployer to Timelock (${ADDRESSES[networkName].timelock})`,
      );
    }
  }

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");
  const chainlinkOracle = await hre.ethers.getContract(contractName);

  await accessControlManager?.giveCallPermission(chainlinkOracle.address, "setTokenConfig(TokenConfig)", deployer);
  await accessControlManager?.giveCallPermission(resilientOracle.address, "setTokenConfig(TokenConfig)", deployer);

  const resilientOracleOwner = await resilientOracle.owner();
  const chainlinkOracleOwner = await chainlinkOracle.owner();
  const boundValidatorOwner = await boundValidator.owner();

  if (resilientOracleOwner === deployer) {
    await resilientOracle.transferOwnership(ADDRESSES[networkName].timelock);
    console.log(
      `Ownership of ResilientOracle transfered from deployer to Timelock (${ADDRESSES[networkName].timelock})`,
    );
  }

  if (chainlinkOracleOwner === deployer) {
    await chainlinkOracle.transferOwnership(ADDRESSES[networkName].timelock);
    console.log(
      `Ownership of ChainlinkOracle transfered from deployer to Timelock (${ADDRESSES[networkName].timelock})`,
    );
  }

  if (boundValidatorOwner === deployer) {
    await boundValidator.transferOwnership(ADDRESSES[networkName].timelock);
    console.log(
      `Ownership of BoundValidator transfered from deployer to Timelock (${ADDRESSES[networkName].timelock})`,
    );
  }
};

export default func;
func.tags = ["deploy"];
