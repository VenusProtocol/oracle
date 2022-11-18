import mainnetDeployments from "@venusprotocol/venus-protocol/networks/mainnet.json";
import testnetDeployments from "@venusprotocol/venus-protocol/networks/testnet.json";
import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const ADDRESSES = {
  bsctestnet: {
    vBNBAddress: testnetDeployments.Contracts.vBNB,
    pythOracleAddress: "0xd7308b14BF4008e7C7196eC35610B1427C5702EA",
    binanceFeedRegistryAddress: "0x999DD49FeFdC043fDAC4FE12Bb1e4bb31cB4c47B",
  },
  bscmainnet: {
    vBNBAddress: mainnetDeployments.Contracts.vBNB,
    pythOracleAddress: "",
    binanceFeedRegistryAddress: "",
  },
};

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName = network.name === "bscmainnet" ? "bscmainnet" : "bsctestnet";

  await deploy("BoundValidator", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
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
    proxy: {
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [],
      },
    },
  });

  const vBNBAddress = ADDRESSES[networkName].vBNBAddress;

  await deploy("TwapOracle", {
    contract: network.live ? "TwapOracle" : "MockTwapOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [vBNBAddress],
      },
    },
  });

  const pythOracleAddress = ADDRESSES[networkName].pythOracleAddress;

  await deploy("PythOracle", {
    contract: network.live ? "PythOracle" : "MockPythOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [pythOracleAddress],
      },
    },
  });

  const binanceFeedRegistryAddress = ADDRESSES[networkName].binanceFeedRegistryAddress;

  await deploy("BinanceOracle", {
    contract: network.live ? "BinanceOracle" : "MockBinanceOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [binanceFeedRegistryAddress],
      },
    },
  });
};

export default func;
