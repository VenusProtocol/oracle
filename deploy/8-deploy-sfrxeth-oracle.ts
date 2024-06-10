import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;

  const { sfrxETH, SfrxEthFraxOracle } = ADDRESSES[network.name];

  let SfrxEthFraxOracleAddress = SfrxEthFraxOracle;
  if (!SfrxEthFraxOracle) {
    await deploy("MockSfrxEthFraxOracle", {
      contract: "MockSfrxEthFraxOracle",
      from: deployer,
      log: true,
      autoMine: true,
      skipIfAlreadyDeployed: true,
      args: [],
    });

    const mockSfrxEthFraxOracle = await ethers.getContract("MockSfrxEthFraxOracle");
    SfrxEthFraxOracleAddress = mockSfrxEthFraxOracle.address;

    if ((await mockSfrxEthFraxOracle.owner()) === deployer) {
      await mockSfrxEthFraxOracle.transferOwnership(proxyOwnerAddress);
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
func.tags = ["sFraxETHOracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
