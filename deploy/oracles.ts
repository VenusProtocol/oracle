// npx hardhat deploy --network bsctestnet
import networks from "@venusprotocol/venus-protocol/networks/mainnet.json";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

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

  const boundValidator = await ethers.getContract("BoundValidator");

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

  const vBNBAddress = networks.Contracts.vBNB;

  await deploy("PivotTwapOracle", {
    contract: network.live ? "PivotTwapOracle" : "MockTwapOracle",
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

  // @todo: just testnet address, will be replaced to mainnet version in the future
  const actualPythOracleAddress = "0xd7308b14BF4008e7C7196eC35610B1427C5702EA";

  await deploy("PythOracle", {
    contract: network.live ? "PythOracle" : "MockPythOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [actualPythOracleAddress],
      },
    },
  });

  // @todo: just testnet address, will be replaced to mainnet version in the future
  const actualBinanceFeedRegistryAddress = "0x999DD49FeFdC043fDAC4FE12Bb1e4bb31cB4c47B";

  await deploy("BinanceOracle", {
    contract: network.live ? "BinanceOracle" : "MockBinanceOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [actualBinanceFeedRegistryAddress],
      },
    },
  });
};

export default func;
