import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { Oracles, assets, getOraclesData } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ network, deployments, getNamedAccounts }: HardhatRuntimeEnvironment) {
  const networkName: string = network.name === "hardhat" ? "bsctestnet" : network.name;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");

  const oraclesData: Oracles = await getOraclesData();

  for (const asset of assets[networkName]) {
    const { oracle } = asset;
    console.log(`Configuring ${asset.token}`);

    await deploy(`Mock${asset.token}`, {
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [`Mock${asset.token}`, `Mock${asset.token}`, 18],
      autoMine: true,
      contract: "BEP20Harness",
    });

    const mock = await hre.ethers.getContract(`Mock${asset.token}`);

    console.log(`Configuring resilient oracle for ${asset.token}`);
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
};

export default func;
func.tags = ["configure"];
func.skip = async env => env.network.live;
