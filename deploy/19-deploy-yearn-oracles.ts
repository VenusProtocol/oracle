import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { WETH, USDC, USDT, USDS, yvUSDC_1, yvUSDT_1, yvUSDS_1, yvWETH_1 } = ADDRESSES[network.name];

  const resilientOracle = await ethers.getContract("ResilientOracle");
  await deploy("yvUSDC-1_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [yvUSDC_1, USDC, resilientOracle.address],
  });

  await deploy("yvUSDT-1_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [yvUSDT_1, USDT, resilientOracle.address],
  });

  await deploy("yvUSDS-1_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [yvUSDS_1, USDS, resilientOracle.address],
  });

  await deploy("yvWETH-1_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [yvWETH_1, WETH, resilientOracle.address],
  });
};

func.tags = ["yearn"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";

export default func;
