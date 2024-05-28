import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;
  const { SfrxEthFraxOracle, sfrxETH } = ADDRESSES[network.name];

  let SfrxEthFraxOracleAddress = SfrxEthFraxOracle;
  if (!SfrxEthFraxOracleAddress) {
    await deploy("MockSfrxEthFraxOracle", {
      contract: "MockSfrxEthFraxOracle",
      from: deployer,
      log: true,
      autoMine: true,
      skipIfAlreadyDeployed: true,
      args: [],
    });

    const mockSfrxEthFraxOracleContract = await ethers.getContract("MockSfrxEthFraxOracle");
    SfrxEthFraxOracleAddress = mockSfrxEthFraxOracleContract.address;

    if ((await mockSfrxEthFraxOracleContract.owner()) === deployer) {
      await mockSfrxEthFraxOracleContract.transferOwnership(proxyOwnerAddress);
    }
  }

  await deploy("SFrxETHOracle", {
    contract: "SFrxETHOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [SfrxEthFraxOracleAddress, sfrxETH],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
    },
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.tags = ["sFraxOracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
