import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const oracle = await ethers.getContract("ResilientOracle");
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;

  const defaultProxyAdmin = await hre.artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  const { PTweETH_26DEC2024, PTweETH_26DEC2024_Market, PTOracle, WETH } = ADDRESSES[network.name];

  const ptOracleAddress = PTOracle || (await ethers.getContract("MockPendlePtOracle")).address;

  await deploy("PendleOracle-PT-weETH-26DEC2024", {
    contract: "PendleOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      PTweETH_26DEC2024_Market || "0x0000000000000000000000000000000000000001",
      ptOracleAddress,
      PTweETH_26DEC2024,
      WETH,
      oracle.address,
      1800,
    ],
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
func.tags = ["pendle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
