import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, addr0000, assets } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log(`Deployer ${deployer}`);

  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;

  const { stETHAddress, wstETHAddress } = ADDRESSES[network.name];
  const WETHAsset = assets[network.name].find(asset => asset.token === "WETH");
  const WETHAddress = WETHAsset?.address ?? addr0000;

  const defaultProxyAdmin = await hre.artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  const oracle = await ethers.getContract("ResilientOracle");

  // Equivalence and NonEquivalence is related to if the oracle will
  // assume 1/1 price ration between stETH/ETH or
  // will get stETH/USD price from secondary market

  await deploy("WstETHOracle_Equivalence", {
    contract: "WstETHOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [wstETHAddress, WETHAddress, stETHAddress, oracle.address, true],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
  });

  await deploy("WstETHOracle_NonEquivalence", {
    contract: "WstETHOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [wstETHAddress, WETHAddress, stETHAddress, oracle.address, false],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
  });
};

export default func;
func.tags = ["wsteth"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
