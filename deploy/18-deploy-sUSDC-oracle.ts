import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, DAYS_30, getSnapshotGap, increaseExchangeRateByPercentage } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { sUSDS, USDS, acm } = ADDRESSES[network.name];

  const sUSDe_ANNUAL_GROWTH_RATE = ethers.utils.parseUnits("0.1624", 18); // 16.24%
  const block = await ethers.provider.getBlock("latest");
  const vault = await ethers.getContractAt("IERC4626", sUSDS);
  const exchangeRate = await vault.convertToAssets(parseUnits("1", 18));
  const resilientOracle = await ethers.getContract("ResilientOracle");
  const snapshotGap = BigNumber.from("135"); // 1.35%

  await deploy("sUSDS_ERC4626Oracle", {
    contract: "ERC4626Oracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      sUSDS,
      USDS,
      resilientOracle.address,
      sUSDe_ANNUAL_GROWTH_RATE,
      DAYS_30,
      increaseExchangeRateByPercentage(exchangeRate, snapshotGap),
      block.timestamp,
      acm,
      getSnapshotGap(exchangeRate, snapshotGap.toNumber()),
    ],
  });
};

func.tags = ["sUSDS"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";

export default func;
