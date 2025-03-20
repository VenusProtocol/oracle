import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({
  getNamedAccounts,
  deployments,
  network,
  artifacts,
}: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const oracle = await ethers.getContract("ResilientOracle");
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;

  const { asBNB, slisBNB } = ADDRESSES[network.name];
  const defaultProxyAdmin = await artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  // Deploy dependencies for testnet
  if(network.name === "bsctestnet") {
    await deploy("MockAsBNBMinter", {
      from: deployer,
      contract: "MockAsBNBMinter",
      args: [],
      log: true,
      autoMine: true,
      skipIfAlreadyDeployed: true,
    });
  
    const minter = await ethers.getContract("MockAsBNBMinter");
  
    await deploy("MockAsBNB", {
      from: deployer,
      contract: "MockAsBNB",
      args: ["Astherus BNB", "asBNB", 18, minter.address],
      log: true,
      autoMine: true,
      skipIfAlreadyDeployed: true,
    });
  }

  console.log("args", asBNB, slisBNB, oracle.address);
  await deploy("AsBNBOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [asBNB, slisBNB, oracle.address],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.tags = ["asBnbOracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "bsctestnet" && hre.network.name !== "bscmainnet";
