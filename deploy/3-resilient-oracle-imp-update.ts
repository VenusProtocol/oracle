import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy, catchUnknownSigner } = deployments;
  const { deployer } = await getNamedAccounts();

  const { vBNBAddress } = ADDRESSES[network.name];
  const { VAIAddress } = ADDRESSES[network.name];

  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;
  const boundValidator = await hre.ethers.getContract("BoundValidator");

  await catchUnknownSigner(
    deploy("ResilientOracle", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [vBNBAddress, VAIAddress, boundValidator.address],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentProxy",
      },
    }),
  );
};

export default func;
func.tags = ["update-resilientOracle"];
func.skip = async env => !env.network.live;
