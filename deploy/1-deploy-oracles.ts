import mainnetDeployments from "@venusprotocol/venus-protocol/networks/mainnet.json";
import testnetDeployments from "@venusprotocol/venus-protocol/networks/testnet.json";
import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const ADDRESSES = {
  bsctestnet: {
    vBNBAddress: testnetDeployments.Contracts.vBNB,
    WBNBAddress: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    pythOracleAddress: "0xd7308b14BF4008e7C7196eC35610B1427C5702EA",
    sidRegistryAddress: "0xfFB52185b56603e0fd71De9de4F6f902f05EEA23",
  },
  bscmainnet: {
    vBNBAddress: mainnetDeployments.Contracts.vBNB,
    WBNBAddress: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    pythOracleAddress: "0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594",
    sidRegistryAddress: "0x08CEd32a7f3eeC915Ba84415e9C07a7286977956",
  },
};

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName = network.name === "bscmainnet" ? "bscmainnet" : "bsctestnet";

  const vBNBAddress = ADDRESSES[networkName].vBNBAddress;
  const WBNBAddress = ADDRESSES[networkName].WBNBAddress;

  await deploy("BoundValidator", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [vBNBAddress],
    proxy: {
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [],
      },
    },
  });

  const boundValidator = await hre.ethers.getContract("BoundValidator");

  await deploy("ResilientOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [vBNBAddress],
    proxy: {
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [boundValidator.address],
      },
    },
  });

  await deploy("ChainlinkOracle", {
    contract: network.live ? "ChainlinkOracle" : "MockChainlinkOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: network.live ? [vBNBAddress] : [],
    proxy: {
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [],
      },
    },
  });

  await deploy("TwapOracle", {
    contract: network.live ? "TwapOracle" : "MockTwapOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: network.live ? [vBNBAddress, WBNBAddress] : [],
    proxy: {
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [] : [vBNBAddress],
      },
    },
  });

  const pythOracleAddress = ADDRESSES[networkName].pythOracleAddress;

  await deploy("PythOracle", {
    contract: network.live ? "PythOracle" : "MockPythOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: network.live ? [vBNBAddress] : [],
    proxy: {
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [pythOracleAddress],
      },
    },
  });

  const sidRegistryAddress = ADDRESSES[networkName].sidRegistryAddress;

  await deploy("BinanceOracle", {
    contract: network.live ? "BinanceOracle" : "MockBinanceOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: network.live ? [vBNBAddress] : [],
    proxy: {
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [sidRegistryAddress],
      },
    },
  });
};

module.exports = func;
module.exports.tags = ["deploy"];
