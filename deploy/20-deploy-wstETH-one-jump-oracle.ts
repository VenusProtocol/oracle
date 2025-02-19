import hre from "hardhat";
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
  if (!deployer) {
    throw new Error("Deployer address is not defined. Ensure deployer is set in namedAccounts.");
  }
  const proxyOwnerAddress = ADDRESSES[network.name].timelock;
  const { WETH, wstETH } = ADDRESSES[network.name];

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");

  const chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");

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

  await deploy("wstETHOneJumpChainlinkOracle", {
    contract: "OneJumpOracle",
    args: [wstETH, WETH, resilientOracle.address, chainlinkOracle.address],
    ...commonParams,
  });
};

func.skip = async () => !["bscmainnet", "bsctestnet", "zksyncsepolia", "zksyncmainnet"].includes(hre.network.name);
func.tags = ["wstETH_OneJumpOracle"];
export default func;
