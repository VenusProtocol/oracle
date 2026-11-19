import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const oracle = await ethers.getContract("ResilientOracle");

  const { asBNB, slisBNB, acm } = ADDRESSES[network.name];

  const SNAPSHOT_UPDATE_INTERVAL = 86400; // 24 hours - CAPO must be active
  const asBNB_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.10", 18); // 10% annual for staking
  const SNAPSHOT_GAP = ethers.utils.parseUnits("0.01", 18); // 1% safety margin

  // Deploy dependencies for testnet
  if (network.name === "bsctestnet") {
    await deploy("MockAsBNBMinter", {
      from: deployer,
      contract: "MockAsBNBMinter",
      args: [],
      log: true,
      autoMine: true,
      skipIfAlreadyDeployed: true,
    });

    const minter = await ethers.getContract("MockAsBNBMinter");

    await deploy("MockAsBNB", {
      from: deployer,
      contract: "MockAsBNB",
      args: ["Astherus BNB", "asBNB", 18, minter.address],
      log: true,
      autoMine: true,
      skipIfAlreadyDeployed: true,
    });
  }

  const asBNBContract = await ethers.getContractAt("IAsBNB", asBNB);
  const minterAddress = await asBNBContract.minter();
  const minterContract = await ethers.getContractAt("IAsBNBMinter", minterAddress);
  const exchangeRate = await minterContract.convertToTokens(ethers.utils.parseUnits("1", 18));
  const block = await ethers.provider.getBlock("latest");

  await deploy("AsBNBOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      asBNB,
      slisBNB,
      oracle.address,
      asBNB_ANNUAL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      exchangeRate,
      block.timestamp,
      acm,
      SNAPSHOT_GAP,
    ],
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.tags = ["asBnbOracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  hre.network.name !== "bsctestnet" && hre.network.name !== "bscmainnet";
