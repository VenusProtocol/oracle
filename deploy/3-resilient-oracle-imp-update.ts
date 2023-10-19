import mainnetDeployments from "@venusprotocol/venus-protocol/networks/mainnet.json";
import testnetDeployments from "@venusprotocol/venus-protocol/networks/testnet.json";
import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const ADDRESSES = {
  bsctestnet: {
    vBNBAddress: testnetDeployments.Contracts.vBNB,
    WBNBAddress: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    VAIAddress: testnetDeployments.Contracts.VAI,
    pythOracleAddress: "0xd7308b14BF4008e7C7196eC35610B1427C5702EA",
    sidRegistryAddress: "0xfFB52185b56603e0fd71De9de4F6f902f05EEA23",
    acm: "0x45f8a08F534f34A97187626E05d4b6648Eeaa9AA",
    timelock: testnetDeployments.Contracts.Timelock,
  },
  bscmainnet: {
    vBNBAddress: mainnetDeployments.Contracts.vBNB,
    WBNBAddress: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    VAIAddress: mainnetDeployments.Contracts.VAI,
    pythOracleAddress: "0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594",
    sidRegistryAddress: "0x08CEd32a7f3eeC915Ba84415e9C07a7286977956",
    acm: "0x4788629ABc6cFCA10F9f969efdEAa1cF70c23555",
    timelock: mainnetDeployments.Contracts.Timelock,
  },
};

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy, catchUnknownSigner } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName = network.name === "bscmainnet" ? "bscmainnet" : "bsctestnet";

  const { vBNBAddress } = ADDRESSES[networkName];
  const { VAIAddress } = ADDRESSES[networkName];
  const { WBNBAddress } = ADDRESSES[networkName];

  const accessControlManagerAddress = ADDRESSES[networkName].acm;
  const proxyOwnerAddress = network.live ? ADDRESSES[networkName].timelock : deployer;
  const boundValidator = await hre.ethers.getContract("BoundValidator");
  console.log(`BV: ${boundValidator.address}`);
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
