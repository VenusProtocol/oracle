import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const networkName: string = network.name === "hardhat" ? "sepolia" : network.name;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const oracle = await ethers.getContract("ResilientOracle");
  const proxyOwnerAddress = network.live ? ADDRESSES[networkName].timelock : deployer;

  const { sFRAX, FRAX } = ADDRESSES[networkName];

  await deploy("SFraxOracle", {
    contract: "SFraxOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [sFRAX || (await ethers.getContract("MockSFrax")).address, FRAX, oracle.address],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
    },
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.tags = ["sFraxOracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "ethereum" && hre.network.name !== "sepolia" && hre.network.name !== "hardhat";
