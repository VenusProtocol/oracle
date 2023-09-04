import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../utils/deploymentUtils";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName = network.name === "bscmainnet" ? "bscmainnet" : "bsctestnet";

  const { vBNBAddress } = ADDRESSES[networkName];
  const { VAIAddress } = ADDRESSES[networkName];
  const { WBNBAddress } = ADDRESSES[networkName];

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

  await deploy("BoundValidator", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [accessControlManagerAddress],
      },
    },
  });

  const boundValidator = await hre.ethers.getContract("BoundValidator");

  await deploy("ResilientOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [vBNBAddress, VAIAddress, boundValidator.address],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [accessControlManagerAddress],
      },
    },
  });

  await deploy("ChainlinkOracle", {
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
        args: network.live ? [accessControlManagerAddress] : [],
      },
    },
  });

  await deploy("TwapOracle", {
    contract: network.live ? "TwapOracle" : "MockTwapOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: network.live ? [WBNBAddress] : [],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [accessControlManagerAddress] : [vBNBAddress],
      },
    },
  });

  const { pythOracleAddress } = ADDRESSES[networkName];

  await deploy("PythOracle", {
    contract: network.live ? "PythOracle" : "MockPythOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [pythOracleAddress, accessControlManagerAddress] : [pythOracleAddress],
      },
    },
  });

  const { sidRegistryAddress } = ADDRESSES[networkName];

  await deploy("BinanceOracle", {
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

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");
  const pythOracle = await hre.ethers.getContract("PythOracle");
  const chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");
  const binanceOracle = await hre.ethers.getContract("BinanceOracle");
  const twapOracle = await hre.ethers.getContract("TwapOracle");

  await accessControlManager?.giveCallPermission(chainlinkOracle.address, "setTokenConfig(TokenConfig)", deployer);
  await accessControlManager?.giveCallPermission(pythOracle.address, "setTokenConfig(TokenConfig)", deployer);
  await accessControlManager?.giveCallPermission(resilientOracle.address, "setTokenConfig(TokenConfig)", deployer);

  const resilientOracleOwner = await resilientOracle.owner();
  const pythOracleOwner = await pythOracle.owner();
  const binanceOracleOwner = await binanceOracle.owner();
  const chainlinkOracleOwner = await chainlinkOracle.owner();
  const twapOracleOwner = await twapOracle.owner();
  const boundValidatorOwner = await boundValidator.owner();

  if (resilientOracleOwner === deployer) {
    await resilientOracle.transferOwnership(ADDRESSES[networkName].timelock);
  }

  if (pythOracleOwner === deployer) {
    await pythOracle.transferOwnership(ADDRESSES[networkName].timelock);
  }

  if (binanceOracleOwner === deployer) {
    await binanceOracle.transferOwnership(ADDRESSES[networkName].timelock);
  }

  if (chainlinkOracleOwner === deployer) {
    await chainlinkOracle.transferOwnership(ADDRESSES[networkName].timelock);
  }

  if (twapOracleOwner === deployer) {
    await twapOracle.transferOwnership(ADDRESSES[networkName].timelock);
  }

  if (boundValidatorOwner === deployer) {
    await boundValidator.transferOwnership(ADDRESSES[networkName].timelock);
  }
};

export default func;
func.tags = ["deploy"];
