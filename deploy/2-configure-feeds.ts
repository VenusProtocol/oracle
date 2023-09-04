import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
  Asset,
  DEFAULT_STALE_PERIOD,
  Oracles,
  addr0000,
  assets,
  chainlinkFeed,
  pythID,
} from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ network, deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  const networkName: string = network.name === "hardhat" ? "bsctestnet" : network.name;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");
  const binanceOracle = await hre.ethers.getContract("BinanceOracle");
  const chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");
  const pythOracle = await hre.ethers.getContract("PythOracle");

  const oraclesData: Oracles = {
    chainlink: {
      oracles: [chainlinkOracle.address, addr0000, addr0000],
      enableFlagsForOracles: [true, false, false],
      underlyingOracle: chainlinkOracle,
      getTokenConfig: (asset: Asset, name: string) => ({
        asset: asset.address,
        feed: chainlinkFeed[name][asset.token],
        maxStalePeriod: DEFAULT_STALE_PERIOD,
      }),
    },
    binance: {
      oracles: [binanceOracle.address, addr0000, addr0000],
      enableFlagsForOracles: [true, false, false],
      underlyingOracle: binanceOracle,
      getStalePeriodConfig: (asset: Asset) => [asset.token, DEFAULT_STALE_PERIOD.toString()],
    },
    pyth: {
      oracles: [pythOracle.address, addr0000, addr0000],
      enableFlagsForOracles: [true, false, false],
      underlyingOracle: pythOracle,
      getTokenConfig: (asset: Asset, name: string) => ({
        pythId: pythID[name][asset.token],
        asset: asset.address,
        maxStalePeriod: DEFAULT_STALE_PERIOD,
      }),
    },
  };

  for (const asset of assets[networkName]) {
    const { oracle } = asset;
    console.log(`Configuring ${asset.token}`);

    if (network.live) {
      console.log(`Configuring ${oracle} oracle for ${asset.token}`);

      const { getTokenConfig } = oraclesData[oracle];
      if (oraclesData[oracle].underlyingOracle.address !== binanceOracle.address && getTokenConfig !== undefined) {
        const tx = await oraclesData[oracle].underlyingOracle?.setTokenConfig(getTokenConfig(asset, networkName));
        tx.wait(1);
      }

      const { getStalePeriodConfig } = oraclesData[oracle];
      if (
        oraclesData[oracle].underlyingOracle.address === binanceOracle.address &&
        getStalePeriodConfig !== undefined
      ) {
        const tx = await oraclesData[oracle].underlyingOracle?.setTokenConfig(...getStalePeriodConfig(asset));
        tx.wait(1);
      }

      console.log(`Configuring resillient oracle for ${asset.token}`);
      const tx = await resilientOracle.setTokenConfig({
        asset: asset.address,
        oracles: oraclesData[oracle].oracles,
        enableFlagsForOracles: oraclesData[oracle].enableFlagsForOracles,
      });

      await tx.wait(1);
    } else {
      await deploy(`Mock${asset.token}`, {
        from: deployer,
        log: true,
        deterministicDeployment: false,
        args: [`Mock${asset.token}`, `Mock${asset.token}`, 18],
        autoMine: true,
        contract: "BEP20Harness",
      });

      const mock = await hre.ethers.getContract(`Mock${asset.token}`);

      console.log(`Configuring resillient oracle for ${asset.token}`);
      let tx = await resilientOracle.setTokenConfig({
        asset: mock.address,
        oracles: oraclesData[oracle].oracles,
        enableFlagsForOracles: oraclesData[oracle].enableFlagsForOracles,
      });

      await tx.wait(1);

      console.log(`Configuring ${oracle} oracle for ${asset.token}`);
      tx = await oraclesData[oracle].underlyingOracle?.setPrice(mock.address, asset.price);
      await tx.wait(1);
    }
  }
};

export default func;
func.tags = ["configure"];
