import mainnetDeployments from "@venusprotocol/venus-protocol/networks/mainnet.json";
import testnetDeployments from "@venusprotocol/venus-protocol/networks/testnet.json";
import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const ADDRESSES = {
  bsctestnet: {
    vBNBAddress: testnetDeployments.Contracts.vBNB,
    VAIAddress: testnetDeployments.Contracts.VAI,
    timelock: testnetDeployments.Contracts.Timelock,
  },
  bscmainnet: {
    vBNBAddress: mainnetDeployments.Contracts.vBNB,
    VAIAddress: mainnetDeployments.Contracts.VAI,
    timelock: mainnetDeployments.Contracts.Timelock,
  },
};

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy, catchUnknownSigner } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName = network.name === "bscmainnet" ? "bscmainnet" : "bsctestnet";

  const { vBNBAddress } = ADDRESSES[networkName];
  const { VAIAddress } = ADDRESSES[networkName];

  const proxyOwnerAddress = network.live ? ADDRESSES[networkName].timelock : deployer;
  const boundValidator = await hre.ethers.getContract("BoundValidator");

  await catchUnknownSigner(
    deploy("ResilientOracle", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [vBNBAddress, VAIAddress, boundValidator.address],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentProxy",
      },
    }),
  );
};

export default func;
func.tags = ["update-resilientOracle"];
