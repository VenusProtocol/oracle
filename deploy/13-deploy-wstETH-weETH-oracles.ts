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
  const proxyOwnerAddress = ADDRESSES[network.name].timelock;
  const { WETH, wstETH, weETH, acm } = ADDRESSES[network.name];

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");

  let chainlinkOracle;
  if (hre.network.name === "arbitrumone") {
    chainlinkOracle = await hre.ethers.getContract("SequencerChainlinkOracle");
  } else {
    chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");
  }

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
    args: [wstETH, WETH, resilientOracle.address, chainlinkOracle.address, 0, 0, 0, 0, acm, 0],
    ...commonParams,
  });

  await deploy("weETHOneJumpChainlinkOracle", {
    contract: "OneJumpOracle",
    args: [weETH, WETH, resilientOracle.address, chainlinkOracle.address, 0, 0, 0, 0, acm, 0],
    ...commonParams,
  });

  if (["bscmainnet", "bsctestnet"].includes(hre.network.name)) {
    const redstoneOracle = await hre.ethers.getContract("RedStoneOracle");

    await deploy("wstETHOneJumpRedstoneOracle", {
      contract: "OneJumpOracle",
      args: [wstETH, WETH, resilientOracle.address, redstoneOracle.address, 0, 0, 0, 0, acm, 0],
      ...commonParams,
    });

    await deploy("weETHOneJumpRedstoneOracle", {
      contract: "OneJumpOracle",
      args: [weETH, WETH, resilientOracle.address, redstoneOracle.address, 0, 0, 0, 0, acm, 0],
      ...commonParams,
    });
  }
};

func.skip = async () => !["bscmainnet", "bsctestnet", "arbitrumone", "arbitrumsepolia"].includes(hre.network.name);
func.tags = ["wstETH_weETH_OneJumpOracles"];
export default func;
