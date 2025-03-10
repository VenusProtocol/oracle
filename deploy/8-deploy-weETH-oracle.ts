import { parseUnits } from "ethers/lib/utils";
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

  const resilientOracle = await ethers.getContract("ResilientOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;
  const defaultProxyAdmin = await artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );
  let { EtherFiLiquidityPool } = ADDRESSES[network.name];
  const { weETH, eETH, WETH } = ADDRESSES[network.name];

  EtherFiLiquidityPool = EtherFiLiquidityPool || (await ethers.getContract("MockEtherFiLiquidityPool")).address;

  const SNAPSHOT_UPDATE_INTERVAL = 24 * 60 * 60;
  const weETH_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.038", 18);
  const block = await ethers.provider.getBlock("latest");
  const vault = await ethers.getContractAt("IEtherFiLiquidityPool", EtherFiLiquidityPool);
  const exchangeRate = await vault.amountForShare(parseUnits("1", 18));

  if (network.name === "sepolia") {
    await deploy("WeETHOracle", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [
        EtherFiLiquidityPool,
        weETH,
        eETH,
        resilientOracle.address,
        weETH_ANNUAL_GROWTH_RATE,
        SNAPSHOT_UPDATE_INTERVAL,
        exchangeRate,
        block.timestamp,
      ],
      skipIfAlreadyDeployed: true,
    });
  } else {
    await deploy("WeETHOracle_Equivalence", {
      contract: "WeETHOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [
        EtherFiLiquidityPool,
        weETH,
        WETH,
        resilientOracle.address,
        weETH_ANNUAL_GROWTH_RATE,
        SNAPSHOT_UPDATE_INTERVAL,
        exchangeRate,
        block.timestamp,
      ],
      skipIfAlreadyDeployed: true,
    });

    await deploy("WeETHOracle_NonEquivalence", {
      contract: "OneJumpOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [weETH, WETH, resilientOracle.address, chainlinkOracle.address, 0, 0, 0, 0],
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
  }
};

export default func;
func.tags = ["weETH"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
