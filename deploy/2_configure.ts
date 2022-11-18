import mainnetDeployments from "@venusprotocol/venus-protocol/networks/mainnet.json";
import testnetDeployments from "@venusprotocol/venus-protocol/networks/testnet.json";
import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ChainlinkOracle } from "../src/types/contracts/oracles/ChainlinkOracle";
import { PythOracle } from "../src/types/contracts/oracles/PythOracle";
import { ResilientOracle } from "../src/types/contracts/ResilientOracle";

interface Feed {
  [key: string]: string
}

interface Config {
  [key: string]: Feed
}

const pythID:Config = {
  "bsctestnet": {
    "BNX": "0x843b251236e67259c6c82145bd68fb198c23e7cba5e26c995e39d8257fbf8eb8",
    "BSW": "0x484efc34ed7311f56c1ac389a88d052dcddda88fe26fb8a876022c5b490f9c98"
  }
}

const chainlinkFeed:Config = {
  "bsctestnet": {
    "BNX": "0xf51492DeD1308Da8195C3bfcCF4a7c70fDbF9daE"
  }
}

const assets:Config = {
  "bsctestnet": {
    "BNX": "0xa57b4AefA16De8318603822219908173Ef04A364",
    "BSW": "0x57931bB7CA29dF22E1a7bF43dB0e3D137ccb0C84",
  }
}

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName:string = network.name === "bscmainnet" ? "bscmainnet" : "bsctestnet";

  const resilientOracle:ResilientOracle = await hre.ethers.getContract("ResilientOracle");
  const pythOracle:PythOracle = await hre.ethers.getContract("PythOracle");
  const chainlinkOracle:ChainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");
  const boundValidator = await hre.ethers.getContract("BoundValidator");
  
  //configure BNX
  let tx = await chainlinkOracle.setTokenConfig({
    asset: assets[networkName]['BNX'],
    feed: chainlinkFeed[networkName]["BNX"],
    maxStalePeriod: 1200 // 20 minutes
  })

  await tx.wait(1)

  tx = await pythOracle.setTokenConfig({
    pythId: pythID[networkName]['BNX'],
    asset: assets[networkName]['BNX'],
    maxStalePeriod: 1200
  })

  await tx.wait(1)

  tx = await resilientOracle.setTokenConfig({
    
  })
};

export default func;
