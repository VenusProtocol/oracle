import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

enum PendleRateKind {
  PT_TO_ASSET = 0,
  PT_TO_SY = 1,
}

type OracleConfig = {
  name: string;
  market: string;
  ptToken: string;
  underlyingToken: string;
  ptOracle: string;
  TWAPDuration: number;
  primaryRateKind: PendleRateKind;
}[];

const deployPendleOracle = async (
  deployments: HardhatRuntimeEnvironment["deployments"],
  deployer: string,
  name: string,
  args: any[],
  proxyOwnerAddress: string,
  defaultProxyAdmin: any,
) => {
  const { deploy } = deployments;
  return deploy(name, {
    contract: "PendleOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args,
    skipIfAlreadyDeployed: true,
  });
};

const func: DeployFunction = async ({
  getNamedAccounts,
  deployments,
  network,
  artifacts,
}: HardhatRuntimeEnvironment) => {
  const { deployer } = await getNamedAccounts();

  const oracle = await ethers.getContract("ResilientOracle");
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;
  const defaultProxyAdmin = await artifacts.readArtifact(
    "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
  );

  const addresses = ADDRESSES[network.name];
  const fallbackAddress = "0x0000000000000000000000000000000000000001";

  const getReferenceRateKind = (primaryRateKind: PendleRateKind): { referenceRateKind: PendleRateKind, referenceTag: string } => {
    if (primaryRateKind == PendleRateKind.PT_TO_ASSET) {
      return { referenceRateKind: PendleRateKind.PT_TO_SY, referenceTag: "PtToSy" };
    } else {
      return { referenceRateKind: PendleRateKind.PT_TO_ASSET, referenceTag: "PtToAsset" };
    }
  }

  const deployOracles = async (oracleConfig: OracleConfig) => {
    await Promise.all(
      oracleConfig.map(async ({ name, market, ptToken, underlyingToken, ptOracle, TWAPDuration, primaryRateKind }) => {
        const ptOracleAddress = ptOracle || (await ethers.getContract("MockPendlePtOracle")).address;
        await deployPendleOracle(
          deployments,
          deployer,
          name,
          [
            market || fallbackAddress,
            ptOracleAddress,
            primaryRateKind,
            ptToken,
            underlyingToken,
            oracle.address,
            TWAPDuration,
          ],
          proxyOwnerAddress,
          defaultProxyAdmin,
        );

        const { referenceRateKind, referenceTag } = getReferenceRateKind(primaryRateKind);
        await deployPendleOracle(
          deployments,
          deployer,
          `${name}_${referenceTag}`,
          [
            market || fallbackAddress,
            ptOracleAddress,
            referenceRateKind,
            ptToken,
            underlyingToken,
            oracle.address,
            TWAPDuration,
          ],
          proxyOwnerAddress,
          defaultProxyAdmin,
        );
      }),
    );
  };

  const oracleConfig: OracleConfig = [
    {
      name: "PendleOracle-PT-weETH-26DEC2024",
      market: addresses.PTweETH_26DEC2024_Market,
      ptToken: addresses.PTweETH_26DEC2024,
      underlyingToken: addresses.WETH,
      ptOracle: addresses.PTOracle || (await ethers.getContract("MockPendleOracle")).address,
      TWAPDuration: 1800,
      primaryRateKind: PendleRateKind.PT_TO_ASSET,
    },
    {
      name: "PendleOracle_PT_USDe_27MAR2025",
      market: addresses.PTUSDe_27MAR2025_Market,
      ptToken: addresses.PTUSDe_27MAR2025,
      underlyingToken: addresses.USDe,
      ptOracle:
        network.name === "sepolia"
          ? (await ethers.getContract("MockPendleOracle_PT_USDe_27MAR2025")).address
          : addresses.PTOracle,
      TWAPDuration: 1800,
      primaryRateKind: PendleRateKind.PT_TO_ASSET,
    },
    {
      name: "PendleOracle_PT_sUSDe_27MAR2025",
      market: addresses.PTsUSDe_27MAR2025_Market,
      ptToken: addresses.PTsUSDe_27MAR2025,
      underlyingToken: addresses.USDe,
      ptOracle:
        network.name === "sepolia"
          ? (await ethers.getContract("MockPendleOracle_PT_sUSDe_27MAR2025")).address
          : addresses.PTOracle,
      TWAPDuration: 1800,
      primaryRateKind: PendleRateKind.PT_TO_ASSET,
    },
  ];

  await deployOracles(oracleConfig);

  if (network.name === "sepolia") {
    const NormalTimelock = "0xc332F7D8D5eA72cf760ED0E1c0485c8891C6E0cF"; // SEPOLIA NORMAL TIMELOCK

    const mockContracts = ["MockPendleOracle_PT_USDe_27MAR2025", "MockPendleOracle_PT_sUSDe_27MAR2025"];

    await Promise.all(
      mockContracts.map(async mock => {
        const contract = await ethers.getContract(mock);
        if ((await contract.owner()) === deployer) {
          console.log(`Transferring ownership of ${contract.address} to ${NormalTimelock}`);
          const tx = await contract.transferOwnership(NormalTimelock);
          await tx.wait();
          console.log(`Ownership transferred to ${NormalTimelock}`);
        }
      }),
    );
  }
};

export default func;
func.tags = ["pendle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name !== "ethereum" && hre.network.name !== "sepolia";
