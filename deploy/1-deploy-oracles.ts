import mainnetDeployments from "@venusprotocol/venus-protocol/networks/mainnet.json";
import testnetDeployments from "@venusprotocol/venus-protocol/networks/testnet.json";
import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const ADDRESSES = {
  bsctestnet: {
    vBNBAddress: testnetDeployments.Contracts.vBNB,
    WBNBAddress: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    VAIAddress: testnetDeployments.Contracts.VAI,
    pythOracleAddress: "0xd7308b14BF4008e7C7196eC35610B1427C5702EA",
    sidRegistryAddress: "0xfFB52185b56603e0fd71De9de4F6f902f05EEA23",
    acm: "0x45f8a08F534f34A97187626E05d4b6648Eeaa9AA",
    timelock: testnetDeployments.Contracts.Timelock,
  },
  bscmainnet: {
    vBNBAddress: mainnetDeployments.Contracts.vBNB,
    WBNBAddress: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    VAIAddress: mainnetDeployments.Contracts.VAI,
    pythOracleAddress: "0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594",
    sidRegistryAddress: "0x08CEd32a7f3eeC915Ba84415e9C07a7286977956",
    acm: "0x4788629ABc6cFCA10F9f969efdEAa1cF70c23555",
    timelock: mainnetDeployments.Contracts.Timelock,
  },
};

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName = network.name === "bscmainnet" ? "bscmainnet" : "bsctestnet";

  const vBNBAddress = ADDRESSES[networkName].vBNBAddress;
  const VAIAddress = ADDRESSES[networkName].VAIAddress;
  const WBNBAddress = ADDRESSES[networkName].WBNBAddress;

  let accessControlManager;
  if (!ADDRESSES[networkName].acm) {
    await deploy("AccessControlManager", {
      from: deployer,
      args: [],
      log: true,
      autoMine: true,
    });

    accessControlManager = await hre.ethers.getContract("AccessControlManagerScenario");
  }
  const accessControlManagerAddress = ADDRESSES[networkName].acm
    ? ADDRESSES[networkName].acm
    : accessControlManager?.address;
  const proxyOwnerAddress = ADDRESSES[networkName].acm ? ADDRESSES[networkName].timelock : deployer;

  await deploy("BoundValidator", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [vBNBAddress, VAIAddress],
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
    args: [vBNBAddress, VAIAddress],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [boundValidator.address, accessControlManagerAddress],
      },
    },
  });

  await deploy("ChainlinkOracle", {
    contract: network.live ? "ChainlinkOracle" : "MockChainlinkOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: network.live ? [vBNBAddress, VAIAddress] : [],
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
    args: network.live ? [vBNBAddress, WBNBAddress, VAIAddress] : [],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [accessControlManagerAddress] : [vBNBAddress],
      },
    },
  });

  const pythOracleAddress = ADDRESSES[networkName].pythOracleAddress;

  await deploy("PythOracle", {
    contract: network.live ? "PythOracle" : "MockPythOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: network.live ? [vBNBAddress, VAIAddress] : [],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [pythOracleAddress, accessControlManagerAddress] : [pythOracleAddress],
      },
    },
  });

  const sidRegistryAddress = ADDRESSES[networkName].sidRegistryAddress;

  await deploy("BinanceOracle", {
    contract: network.live ? "BinanceOracle" : "MockBinanceOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: network.live ? [vBNBAddress, VAIAddress] : [],
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

  if (!ADDRESSES[networkName].acm) {
    await accessControlManager?.giveCallPermission(chainlinkOracle.address, "setTokenConfig(TokenConfig)", deployer);
    await accessControlManager?.giveCallPermission(pythOracle.address, "setTokenConfig(TokenConfig)", deployer);
    await accessControlManager?.giveCallPermission(resilientOracle.address, "setTokenConfig(TokenConfig)", deployer);
  }

  const resilientOracleOwner = await resilientOracle.owner();
  const pythOracleOwner = await pythOracle.owner();
  const binanceOracleOwner = await binanceOracle.owner();
  const chainlinkOracleOwner = await chainlinkOracle.owner();
  const twapOracleOwner = await twapOracle.owner();
  const boundValidatorOwner = await boundValidator.owner();

  if (resilientOracleOwner == deployer) {
    await resilientOracle.transferOwnership(ADDRESSES[networkName].timelock);
  }

  if (pythOracleOwner == deployer) {
    await pythOracle.transferOwnership(ADDRESSES[networkName].timelock);
  }

  if (binanceOracleOwner == deployer) {
    await binanceOracle.transferOwnership(ADDRESSES[networkName].timelock);
  }

  if (chainlinkOracleOwner == deployer) {
    await chainlinkOracle.transferOwnership(ADDRESSES[networkName].timelock);
  }

  if (twapOracleOwner == deployer) {
    await twapOracle.transferOwnership(ADDRESSES[networkName].timelock);
  }

  if (boundValidatorOwner == deployer) {
    await boundValidator.transferOwnership(ADDRESSES[networkName].timelock);
  }
};

module.exports = func;
module.exports.tags = ["deploy"];
