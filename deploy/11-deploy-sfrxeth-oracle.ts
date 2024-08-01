import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;
  const defaultProxyAdmin = await hre.artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );
  const { sfrxETH, SfrxEthFraxOracle, acm } = ADDRESSES[network.name];
  const maxAllowedPriceDifference = parseUnits("1.14", 18);

  await deploy("SFrxETHOracle", {
    contract: "SFrxETHOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [SfrxEthFraxOracle || (await ethers.getContract("MockSfrxEthFraxOracle")).address, sfrxETH],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [acm, maxAllowedPriceDifference],
      },
      viaAdminContract: {
        name: "DefaultProxyAdmin",
        artifact: defaultProxyAdmin,
      },
    },
    skipIfAlreadyDeployed: true,
  });

  const sfrxETHOracle = await ethers.getContract("SFrxETHOracle");

  if ((await sfrxETHOracle.owner()) === deployer) {
    await sfrxETHOracle.transferOwnership(proxyOwnerAddress);
  }
};

export default func;
func.tags = ["sFraxETHOracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
