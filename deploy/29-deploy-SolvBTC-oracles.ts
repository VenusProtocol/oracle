import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { SolvBTC, BTCB, acm } = ADDRESSES[network.name];
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;
  const defaultProxyAdmin = await hre.artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  const contractName = "ChainlinkOracle";

  // Deploy a dedicated ChainlinkOracle proxy for the SolvBTC fundamental (self-reported) feed.
  // A separate proxy is required because ChainlinkOracle stores one TokenConfig per asset address,
  // so the shared ChainlinkOracle can only hold one SolvBTC feed. This mirrors the USDTChainlinkOracle
  // and AtlasOracle patterns.
  await deploy("SolvBTCFundamentalChainlinkOracle", {
    contract: network.live ? contractName : "MockChainlinkOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    skipIfAlreadyDeployed: true,
    args: [],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [acm] : [],
      },
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
  });

  const fundamentalOracle = await hre.ethers.getContract("SolvBTCFundamentalChainlinkOracle");
  const fundamentalOracleOwner = await fundamentalOracle.owner();

  if (fundamentalOracleOwner === deployer && network.live) {
    await fundamentalOracle.transferOwnership(proxyOwnerAddress);
    console.log(
      `Ownership of SolvBTCFundamentalChainlinkOracle transferred from deployer to Timelock (${proxyOwnerAddress})`,
    );
  }

  const chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");
  const redstoneOracle = await hre.ethers.getContract("RedStoneOracle");
  const resilientOracle = await hre.ethers.getContract("ResilientOracle");

  // OneJumpOracle constructor args:
  // [correlatedToken, underlyingToken, resilientOracle, intermediateOracle,
  //  annualGrowthRate, snapshotInterval, initialSnapshotMaxExchangeRate, initialSnapshotTimestamp,
  //  accessControlManager, snapshotGap]
  //
  await deploy("SolvBTCOneJumpFundamentalOracle", {
    contract: "OneJumpOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    skipIfAlreadyDeployed: true,
    args: [SolvBTC, BTCB, resilientOracle.address, fundamentalOracle.address, 0, 0, 0, 0, acm, 0],
  });

  await deploy("SolvBTCOneJumpChainlinkOracle", {
    contract: "OneJumpOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    skipIfAlreadyDeployed: true,
    args: [SolvBTC, BTCB, resilientOracle.address, chainlinkOracle.address, 0, 0, 0, 0, acm, 0],
  });

  await deploy("SolvBTCOneJumpRedStoneOracle", {
    contract: "OneJumpOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    skipIfAlreadyDeployed: true,
    args: [SolvBTC, BTCB, resilientOracle.address, redstoneOracle.address, 0, 0, 0, 0, acm, 0],
  });
};

func.tags = ["SolvBTC-oracles"];
func.skip = async env => env.network.name !== "bscmainnet" && env.network.name !== "bsctestnet";
export default func;
