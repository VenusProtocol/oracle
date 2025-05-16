import hre from "hardhat";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  network,
  artifacts,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { WETH, wstETH, weETH } = ADDRESSES[network.name];

  // Validate required addresses
  if (!WETH || !wstETH || !weETH) {
    throw new Error("Missing required token addresses in deployment config");
  }

  // Get existing contracts
  const resilientOracle = await ethers.getContract("ResilientOracle");
  const redstoneOracle = await ethers.getContract("RedStoneOracle");

  // Proxy configuration
  const defaultProxyAdmin = await artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  const commonParams = {
    from: deployer,
    log: true,
    waitConfirmations: 1,
    proxy: {
      owner: ADDRESSES[network.name].timelock,
      proxyContract: "OptimizedTransparentUpgradeableProxy",
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
  };

  // Deploy weETH Oracle
  const weETHOracle = await deploy("weETHOneJumpOracle", {
    contract: "OneJumpOracle",
    args: [weETH, WETH, resilientOracle.address, redstoneOracle.address],
    ...commonParams,
  });

  // Deploy wstETH Oracle
  const wstETHOracle = await deploy("wstETHOneJumpOracle", {
    contract: "OneJumpOracle",
    args: [wstETH, WETH, resilientOracle.address, redstoneOracle.address],
    ...commonParams,
  });

  console.log(`weETH Oracle deployed to: ${weETHOracle.address}`);
  console.log(`wstETH Oracle deployed to: ${wstETHOracle.address}`);
};

func.skip = async () => !["unichainmainnet"].includes(hre.network.name);
func.tags = ["unichain_oracles"];
export default func;
