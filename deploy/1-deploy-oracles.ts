import mainnetDeployments from "@venusprotocol/venus-protocol/networks/mainnet.json";
import testnetDeployments from "@venusprotocol/venus-protocol/networks/testnet.json";
import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const ADDRESSES = {
  bsctestnet: {
    vBNBAddress: testnetDeployments.Contracts.vBNB,
    WBNBAddress: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    VAIAddress: "0x05889b75Ae9Aa53AaE49562432201a0c93BaCA0b",
    pythOracleAddress: "0xd7308b14BF4008e7C7196eC35610B1427C5702EA",
    sidRegistryAddress: "0xfFB52185b56603e0fd71De9de4F6f902f05EEA23",
  },
  bscmainnet: {
    vBNBAddress: mainnetDeployments.Contracts.vBNB,
    WBNBAddress: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    VAIAddress: "0x4BD17003473389A42DAF6a0a729f6Fdb328BbBd7",
    pythOracleAddress: "0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594",
    sidRegistryAddress: "0x08CEd32a7f3eeC915Ba84415e9C07a7286977956",
  },
};

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName = network.name === "bscmainnet" ? "bscmainnet" : "bsctestnet";

  const vBNBAddress = ADDRESSES[networkName].vBNBAddress;
  const VAIAddress = ADDRESSES[networkName].VAIAddress;
  const WBNBAddress = ADDRESSES[networkName].WBNBAddress;

  await deploy("AccessControlManager", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  const accessControlManager = await hre.ethers.getContract("AccessControlManager");

  await deploy("BoundValidator", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [vBNBAddress, VAIAddress],
    proxy: {
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [accessControlManager.address],
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
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [boundValidator.address, accessControlManager.address],
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
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [accessControlManager.address] : [],
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
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [accessControlManager.address] : [vBNBAddress],
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
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [pythOracleAddress, accessControlManager.address] : [pythOracleAddress],
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
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [sidRegistryAddress],
      },
    },
  });

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");
  const pythOracle = await hre.ethers.getContract("PythOracle");
  const chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");

  await accessControlManager.giveCallPermission(chainlinkOracle.address, "setTokenConfig(TokenConfig)", deployer);

  await accessControlManager.giveCallPermission(pythOracle.address, "setTokenConfig(TokenConfig)", deployer);

  await accessControlManager.giveCallPermission(resilientOracle.address, "setTokenConfig(TokenConfig)", deployer);
};

module.exports = func;
module.exports.tags = ["deploy"];
