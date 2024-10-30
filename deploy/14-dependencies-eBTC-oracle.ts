// import { ethers } from "hardhat";
// import { DeployFunction } from "hardhat-deploy/dist/types";
// import { HardhatRuntimeEnvironment } from "hardhat/types";

// import { ADDRESSES } from "../helpers/deploymentConfig";

// const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
//   const { deploy } = deployments;
//   const { deployer } = await getNamedAccounts();

//   const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;

//   await deploy("MockAccountant_eBTC", {
//     from: deployer,
//     contract: "MockAccountant",
//     args: [],
//     log: true,
//     autoMine: true,
//     skipIfAlreadyDeployed: true,
//   });

//   const mockAccountant = await ethers.getContract("MockAccountant_eBTC");
//   await mockAccountant.transferOwnership(proxyOwnerAddress);
// };

// export default func;
// func.tags = ["eBTCAccountantOracle"];
// func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "sepolia";
