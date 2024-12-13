import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

type OracleConfig = {
  name: string;
  market: string;
  token: string;
  collateral: string;
  customOracle: string;
}[];

const deployPendleOracle = async (
  deployments: HardhatRuntimeEnvironment["deployments"],
  deployer: string,
  name: string,
  args: any[],
  proxyOwnerAddress: string,
  defaultProxyAdmin: any,
) => {
  const { deploy } = deployments;
  return deploy(name, {
    contract: "PendleOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args,
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

const func: DeployFunction = async ({
  getNamedAccounts,
  deployments,
  network,
  artifacts,
}: HardhatRuntimeEnvironment) => {
  const { deployer } = await getNamedAccounts();

  const oracle = await ethers.getContract("ResilientOracle");
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;
  const defaultProxyAdmin = await artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  const addresses = ADDRESSES[network.name];
  const fallbackAddress = "0x0000000000000000000000000000000000000001";

  const deployOracles = async (oracleConfig: OracleConfig) => {
    for (const { name, market, token, collateral, customOracle } of oracleConfig) {
      const ptOracleAddress = customOracle || (await ethers.getContract("MockPendlePtOracle")).address;
      await deployPendleOracle(
        deployments,
        deployer,
        name,
        [market || fallbackAddress, ptOracleAddress, token, collateral, oracle.address, 1800],
        proxyOwnerAddress,
        defaultProxyAdmin,
      );
    }
  };

  const oracleConfig: OracleConfig = [
    {
      name: "PendleOracle-PT-weETH-26DEC2024",
      market: addresses.PTweETH_26DEC2024_Market,
      token: addresses.PTweETH_26DEC2024,
      collateral: addresses.WETH,
      customOracle: addresses.PTOracle || (await ethers.getContract("MockPendleOracle")).address,
    },
    {
      name: "PendleOracle_PT_USDe_27MAR2025",
      market: addresses.PTUSDe_27MAR2025_Market,
      token: addresses.PTUSDe_27MAR2025,
      collateral: addresses.USDe,
      customOracle:
        network.name === "sepolia"
          ? (await ethers.getContract("MockPendleOracle_PT_USDe_27MAR2025")).address
          : addresses.PTOracle,
    },
    {
      name: "PendleOracle_PT_sUSDe_27MAR2025",
      market: addresses.PTsUSDe_27MAR2025_Market,
      token: addresses.PTsUSDe_27MAR2025,
      collateral: addresses.USDe,
      customOracle:
        network.name === "sepolia"
          ? (await ethers.getContract("MockPendleOracle_PT_sUSDe_27MAR2025")).address
          : addresses.PTOracle,
    },
  ];

  await deployOracles(oracleConfig);

  if (network.name === "sepolia") {
    const NormalTimelock = "0xc332F7D8D5eA72cf760ED0E1c0485c8891C6E0cF"; // SEPOLIA NORMAL TIMELOCK

    const mockContracts = ["MockPendleOracle_PT_USDe_27MAR2025", "MockPendleOracle_PT_sUSDe_27MAR2025"];

    for (const mock of mockContracts) {
      const contract = await ethers.getContract(mock);
      if ((await contract.owner()) === deployer) {
        console.log(`Transferring ownership of ${contract.address} to ${NormalTimelock}`);
        const tx = await contract.transferOwnership(NormalTimelock);
        await tx.wait();
        console.log(`Ownership transferred to ${NormalTimelock}`);
      }
    }
  }
};

export default func;
func.tags = ["pendle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
