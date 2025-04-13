import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { isMainnet } from "../helpers/deploymentUtils";

enum PendleRateKind {
  PT_TO_ASSET = 0,
  PT_TO_SY = 1,
}

const func: DeployFunction = async ({
  getNamedAccounts,
  deployments,
  network,
  artifacts,
}: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyOwnerAddress = ADDRESSES[network.name].timelock;
  const redStoneOracle = await ethers.getContract("RedStoneOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  const resilientOracle = await ethers.getContract("ResilientOracle");
  const addresses = ADDRESSES[network.name];
  const ptOracleAddress = addresses.PTOracle || (await ethers.getContract("MockPendlePtOracle")).address;

  const defaultProxyAdmin = await artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  const commonParams = {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
    skipIfAlreadyDeployed: true,
    waitConfirmations: 1,
  };

  await deploy("sUSDeOneJumpChainlinkOracle", {
    contract: "OneJumpOracle",
    args: [addresses.sUSDe, addresses.USDe, resilientOracle.address, chainlinkOracle.address],
    ...commonParams,
  });

  await deploy("sUSDeOneJumpRedstoneOracle", {
    contract: "OneJumpOracle",
    args: [addresses.sUSDe, addresses.USDe, resilientOracle.address, redStoneOracle.address],
    ...commonParams,
  });

  await deploy("PendleOracle-PT-sUSDe-26JUN2025", {
    contract: "PendleOracle",
    args: [
      addresses["PT-sUSDE-26JUN2025_Market"] || "0x0000000000000000000000000000000000000003",
      ptOracleAddress,
      PendleRateKind.PT_TO_SY,
      addresses["PT-sUSDE-26JUN2025"],
      addresses.sUSDe,
      resilientOracle.address,
      1800,
    ],
    ...commonParams,
  });

  if (isMainnet(network)) {
    const referenceOracle = await ethers.getContract("ReferenceOracle");
    const { devMultisig } = addresses;
    await deploy("PendleOracle-PT-sUSDe-26JUN2025_Reference_PtToAsset", {
      contract: "PendleOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [
        addresses["PT-sUSDE-26JUN2025_Market"] || "0x0000000000000000000000000000000000000003",
        ptOracleAddress,
        PendleRateKind.PT_TO_ASSET,
        addresses["PT-sUSDE-26JUN2025"],
        addresses.USDe,
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
func.tags = ["PT-sUSDe"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "bsctestnet" && hre.network.name !== "bscmainnet";
