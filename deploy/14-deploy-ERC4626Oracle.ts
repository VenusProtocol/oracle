import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const sUSDe = "0xA3A3e5ecEA56940a4Ae32d0927bfd8821DdA848A";
  const USDe = "0x8bAe3E12870a002A0D4b6Eb0F0CBf91b29d9806F";

  const resilientOracle = await ethers.getContract("ResilientOracle");
  await deploy("sUSDe_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [sUSDe, USDe, resilientOracle.address],
  });
};

func.tags = ["deploy-ERC4626-oracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";

export default func;
