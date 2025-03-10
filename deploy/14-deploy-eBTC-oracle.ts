import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const resilientOracle = await ethers.getContract("ResilientOracle");
  let { eBTC_Accountant } = ADDRESSES[network.name];
  const { WBTC, eBTC } = ADDRESSES[network.name];

  eBTC_Accountant = eBTC_Accountant || (await ethers.getContract("MockAccountant_eBTC")).address;

  const SNAPSHOT_UPDATE_INTERVAL = 24 * 60 * 60;
  const eBTC_ANNUL_GROWTH_RATE = ethers.utils.parseUnits("0.03", 18);
  const block = await ethers.provider.getBlock("latest");
  const accountant = await ethers.getContractAt("IAccountant", eBTC_Accountant);
  const exchangeRate = await accountant.getRateSafe();

  await deploy("eBTCAccountantOracle", {
    contract: "EtherfiAccountantOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      eBTC_Accountant,
      eBTC,
      WBTC,
      resilientOracle.address,
      eBTC_ANNUL_GROWTH_RATE,
      SNAPSHOT_UPDATE_INTERVAL,
      exchangeRate,
      block.timestamp,
    ],
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.tags = ["eBTCAccountantOracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
