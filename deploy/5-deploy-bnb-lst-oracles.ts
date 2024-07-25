import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, assets } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const oracle = await ethers.getContract("ResilientOracle");
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;
  const MAX_FEE_PER_GAS = network.name === "zksyncsepolia" || network.name === "zksync" ? "200000000" : "0";

  const { ankrBNB, stkBNB, BNBx, BNBxStakeManager, slisBNBStakeManager, stkBNBStakePool, slisBNB, wBETH } =
    ADDRESSES[network.name];
  const ETH = assets[network.name].find(asset => asset.token === "ETH");
  const defaultProxyAdmin = await hre.artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );
  await deploy("BNBxOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [BNBxStakeManager, BNBx, oracle.address],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
    maxFeePerGas: MAX_FEE_PER_GAS,
    skipIfAlreadyDeployed: true,
  });

  await deploy("SlisBNBOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [slisBNBStakeManager, slisBNB, oracle.address],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
    maxFeePerGas: MAX_FEE_PER_GAS,
    skipIfAlreadyDeployed: true,
  });

  await deploy("StkBNBOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [stkBNBStakePool, stkBNB, oracle.address],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
    maxFeePerGas: MAX_FEE_PER_GAS,
    skipIfAlreadyDeployed: true,
  });

  let ankrBNBAddress = ankrBNB;
  if (!ankrBNB) {
    // deploy MockAnkrBNB
    await deploy("MockAnkrBNB", {
      from: deployer,
      log: true,
      autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
      skipIfAlreadyDeployed: true,
      args: ["Ankr Staked BNB ", "ankrBNB", "18"],
    });

    const ankrBNBContract = await ethers.getContract("MockAnkrBNB");
    ankrBNBAddress = ankrBNBContract.address;

    if ((await ankrBNBContract.owner()) === deployer) {
      await ankrBNBContract.transferOwnership(proxyOwnerAddress);
    }
  }

  await deploy("AnkrBNBOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [ankrBNBAddress, oracle.address],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
    maxFeePerGas: MAX_FEE_PER_GAS,
    skipIfAlreadyDeployed: true,
  });

  let wBETHAddress = wBETH;
  if (!wBETH) {
    // deploy MockWBETH
    await deploy("MockWBETH", {
      from: deployer,
      log: true,
      autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
      skipIfAlreadyDeployed: true,
      args: ["Wrapped Binance Beacon ETH", "wBETH", "18"],
    });

    const wBETHContract = await ethers.getContract("MockWBETH");
    wBETHAddress = wBETHContract.address;

    if ((await wBETHContract.owner()) === deployer) {
      await wBETHContract.transferOwnership(proxyOwnerAddress);
    }
  }

  await deploy("WBETHOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [wBETHAddress, ETH?.address, oracle.address],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
    maxFeePerGas: MAX_FEE_PER_GAS,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.tags = ["bnb_lst"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "bscmainnet" && hre.network.name !== "bsctestnet";
