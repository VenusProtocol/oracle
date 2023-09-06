import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { Asset, Oracles, assets, getOraclesData } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ network, deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  const networkName: string = network.name === "hardhat" ? "bsctestnet" : network.name;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");
  const binanceOracle = await hre.ethers.getContract("BinanceOracle");
  const chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");

  const oraclesData: Oracles = await getOraclesData();

  for (const asset of assets[networkName]) {
    const { oracle } = asset;
    console.log(`Configuring ${asset.token}`);

    if (network.live) {
      console.log(`Configuring ${oracle} oracle for ${asset.token}`);

      const { getTokenConfig, getDirectPriceConfig } = oraclesData[oracle];

      if (
        oraclesData[oracle].underlyingOracle.address === chainlinkOracle.address &&
        getDirectPriceConfig !== undefined
      ) {
        const assetConfig: any = getDirectPriceConfig(asset);
        const tx = await oraclesData[oracle].underlyingOracle?.setDirectPrice(assetConfig.asset, assetConfig.price);
        tx.wait(1);
      }

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
