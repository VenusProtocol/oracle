import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

// Venus Hub receipt tokens: 24-decimal ERC4626 vaults over USDT, USDC and U.
const VAULTS = [
  { vault: "vhUSDT", asset: "USDT" },
  { vault: "vhUSDC", asset: "USDC" },
  { vault: "vhU", asset: "U" },
];

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const addresses = ADDRESSES[network.name];
  const resilientOracle = await ethers.getContract("ResilientOracle");

  // Cap arguments (annual growth rate, snapshot interval, initial snapshot, snapshot timestamp and
  // snapshot gap) are all deployed zeroed. VIP-664 arms the cap afterwards with setSnapshot,
  // setGrowthRate and setSnapshotGap, the same way VIP-530 armed the asBNB oracle.
  for (const { vault, asset } of VAULTS) {
    await deploy(`${vault}_ERC4626Oracle`, {
      contract: "ERC4626Oracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      skipIfAlreadyDeployed: true,
      args: [addresses[vault], addresses[asset], resilientOracle.address, 0, 0, 0, 0, addresses.acm, 0],
    });
  }
};

export default func;
func.tags = ["vh-erc4626-oracles"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "bscmainnet";
