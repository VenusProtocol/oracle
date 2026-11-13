import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// Stork's contract on BNB Chain, which stores every Stork feed
const STORK = "0x7D06cc8210228365896A3cc8Aac88c5551529112";

// Stork feed ID of the sUSN -> USN exchange rate, pushed hourly
const SUSN_FEED_ID = "0x77003d6da8f95711efa901495c607c987dfaedd55d24c6f935286f2851ed915e";

const func: DeployFunction = async ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // The constructor reads the feed through Stork's 1-hour age check, so a deploy sent just before an hourly
  // push lands can revert. Send it again after the push.
  await deploy("sUSN_StorkChainlinkAdapter", {
    contract: "StorkChainlinkAdapter",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    skipIfAlreadyDeployed: true,
    args: [STORK, SUSN_FEED_ID],
  });
};

export default func;
func.tags = ["sUSN-stork-adapter"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "bscmainnet";
