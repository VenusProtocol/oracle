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
  const MAX_FEE_PER_GAS = network.name === "zksyncsepolia" || network.name === "zksync" ? "200000000" : "0";

  const { PTweETH_26DEC2024, PTweETH_26DEC2024_Market, PTOracle, WETH } = ADDRESSES[network.name];

  let ptOracleAddress = PTOracle;
  if (!ptOracleAddress) {
    // deploy MockAnkrBNB
    await deploy("MockPendlePtOracle", {
      contract: "MockPendlePtOracle",
      from: deployer,
      log: true,
      autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
      skipIfAlreadyDeployed: true,
      args: [],
    });

    const pendleOracleContract = await ethers.getContract("MockPendlePtOracle");
    ptOracleAddress = pendleOracleContract.address;

    if ((await pendleOracleContract.owner()) === deployer) {
      await pendleOracleContract.transferOwnership(proxyOwnerAddress);
    }
  }

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
    maxFeePerGas: MAX_FEE_PER_GAS,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.tags = ["pendle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
