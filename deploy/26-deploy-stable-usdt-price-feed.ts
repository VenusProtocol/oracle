import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // Get the ResilientOracle contract
  const resilientOracle = await hre.ethers.getContract("ResilientOracle");

  await deploy("StableUsdtPriceFeed", {
    contract: "StableUsdtPriceFeed",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    skipIfAlreadyDeployed: true,
    args: [resilientOracle.address],
  });

  const stableUsdtPriceFeed = await hre.ethers.getContract("StableUsdtPriceFeed");
  console.log(`StableUsdtPriceFeed deployed at: ${stableUsdtPriceFeed.address}`);
  console.log(`Resilient Oracle address: ${resilientOracle.address}`);
};

func.tags = ["stable-usdt-price-feed"];
func.skip = async (hr: HardhatRuntimeEnvironment) =>
  hr.network.name !== "bscmainnet" && hr.network.name !== "bsctestnet";

export default func;
