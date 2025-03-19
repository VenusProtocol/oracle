import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { isMainnet } from "../helpers/deploymentUtils";

enum PendleRateKind {
  PT_TO_ASSET = 0,
  PT_TO_SY = 1,
}

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const oracle = await ethers.getContract("ResilientOracle");
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;
  const addresses = ADDRESSES[network.name];
  const ptOracleAddress = addresses.PTOracle || (await ethers.getContract("MockPendlePtOracle")).address;

  await deploy("PendleOracle-PT-clisBNB-24APR2025", {
    contract: "PendleOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      addresses["PT-clisBNB-24APR2025_Market"] || "0x0000000000000000000000000000000000000002",
      ptOracleAddress,
      PendleRateKind.PT_TO_SY,
      addresses["PT-clisBNB-24APR2025"],
      addresses.slisBNB,
      oracle.address,
      1800,
    ],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
    },
    skipIfAlreadyDeployed: true,
  });

  if (isMainnet(network)) {
    const referenceOracle = await ethers.getContract("ReferenceOracle");
    const { devMultisig } = addresses;
    await deploy("PendleOracle-PT-clisBNB-24APR2025_Reference_PtToAsset", {
      contract: "PendleOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [
        addresses["PT-clisBNB-24APR2025_Market"] || "0x0000000000000000000000000000000000000002",
        ptOracleAddress,
        PendleRateKind.PT_TO_ASSET,
        addresses["PT-clisBNB-24APR2025"],
        addresses.WBNBAddress,
        referenceOracle.address,
        1800,
      ],
      proxy: {
        owner: devMultisig,
        proxyContract: "OptimizedTransparentUpgradeableProxy",
        viaAdminContract: {
          name: "DevProxyAdmin",
        },
      },
      skipIfAlreadyDeployed: true,
    });
  }
};

export default func;
func.tags = ["PT-clisBNB"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "bsctestnet" && hre.network.name !== "bscmainnet";
