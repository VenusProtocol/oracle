import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;
  let WETH;
  let rsETH;
  if (network.name === "sepolia" || network.name === "ethereum") {
    ({ WETH } = ADDRESSES[network.name]);
    rsETH =
      network.name === "sepolia"
        ? "0xfA0614E5C803E15070d31f7C38d2d430EBe68E47"
        : "0xA1290d69c65A6Fe4DF752f95823fae25cB99e5A7";
  }

  console.log(`Timelock (${proxyOwnerAddress})`);
  const redStoneOracle = await hre.ethers.getContract("RedStoneOracle");
  const resilientOracle = await hre.ethers.getContract("ResilientOracle");
  const chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");

  await deploy("rsETHOneJumpRedStoneOracle", {
    contract: "OneJumpOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [rsETH, WETH, resilientOracle.address, redStoneOracle.address],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
    },
    skipIfAlreadyDeployed: true,
  });

  await deploy("rsETHOneJumpChainlinkOracle", {
    contract: "OneJumpOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [rsETH, WETH, resilientOracle.address, chainlinkOracle.address],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
    },
    skipIfAlreadyDeployed: true,
  });
};

func.skip = async () => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";

func.tags = ["rsETHOneJumpOracles"];
export default func;
