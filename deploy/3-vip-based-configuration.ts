import { BigNumberish } from "ethers";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
  ADDRESSES,
  ANY_CONTRACT,
  AccessControlEntry,
  Oracles,
  assets,
  getOraclesData,
} from "../helpers/deploymentConfig";
import { AccessControlManager } from "../typechain-types";

interface GovernanceCommand {
  contract: string;
  signature: string;
  parameters: any[];
  value: BigNumberish;
}

const configurePriceFeeds = async (hre: HardhatRuntimeEnvironment): Promise<GovernanceCommand[]> => {
  const networkName = hre.network.name;

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");
  const binanceOracle = await hre.ethers.getContractOrNull("BinanceOracle");
  const chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");
  const oraclesData: Oracles = await getOraclesData();
  const commands: GovernanceCommand[] = [];

  for (const asset of assets[networkName]) {
    const { oracle } = asset;
    console.log(`Adding commands for configuring ${asset.token}`);
    console.log(`Adding a command to configure ${oracle} oracle for ${asset.token}`);

    const { getTokenConfig, getDirectPriceConfig } = oraclesData[oracle];

    if (
      oraclesData[oracle].underlyingOracle.address === chainlinkOracle?.address &&
      getDirectPriceConfig !== undefined
    ) {
      const assetConfig: any = getDirectPriceConfig(asset);
      commands.push({
        contract: oraclesData[oracle].underlyingOracle.address,
        signature: "setDirectPrice(address,uint256)",
        value: 0,
        parameters: [assetConfig.asset, assetConfig.price],
      });
    }

    if (oraclesData[oracle].underlyingOracle.address !== binanceOracle?.address && getTokenConfig !== undefined) {
      const tokenConfig: any = getTokenConfig(asset, networkName);
      commands.push({
        contract: oraclesData[oracle].underlyingOracle.address,
        signature: "setTokenConfig((address,address,uint256))",
        value: 0,
        parameters: [[tokenConfig.asset, tokenConfig.feed, tokenConfig.maxStalePeriod]],
      });
    }

    const { getStalePeriodConfig } = oraclesData[oracle];
    if (oraclesData[oracle].underlyingOracle.address === binanceOracle?.address && getStalePeriodConfig !== undefined) {
      const tokenConfig: any = getStalePeriodConfig(asset);

      commands.push({
        contract: oraclesData[oracle].underlyingOracle.address,
        signature: "setMaxStalePeriod(string,uint256)",
        value: 0,
        parameters: [tokenConfig],
      });
    }

    console.log(``);
    console.log(`Adding a command to configure resilient oracle for ${asset.token}`);
    commands.push({
      contract: resilientOracle.address,
      signature: "setTokenConfig((address,address[3],bool[3]))",
      value: 0,
      parameters: [[asset.address, oraclesData[oracle].oracles, oraclesData[oracle].enableFlagsForOracles]],
    });
  }
  return commands;
};

const acceptOwnership = async (
  contractName: string,
  targetOwner: string,
  hre: HardhatRuntimeEnvironment,
): Promise<GovernanceCommand[]> => {
  if (!hre.network.live) {
    return [];
  }
  const abi = ["function owner() view returns (address)"];
  let deployment;
  try {
    deployment = await hre.deployments.get(contractName);
  } catch (error: any) {
    if (error.message.includes("No deployment found for")) {
      return [];
    }
    throw error;
  }
  const contract = await ethers.getContractAt(abi, deployment.address);
  if ((await contract.owner()) === targetOwner) {
    return [];
  }
  console.log(`Adding a command to accept the admin rights over ${contractName}`);
  return [
    {
      contract: deployment.address,
      signature: "acceptOwnership()",
      parameters: [],
      value: 0,
    },
  ];
};

const makeRole = (mainnetBehavior: boolean, targetContract: string, method: string): string => {
  if (mainnetBehavior && targetContract === ethers.constants.AddressZero) {
    return ethers.utils.keccak256(
      ethers.utils.solidityPack(["bytes32", "string"], [ethers.constants.HashZero, method]),
    );
  }
  return ethers.utils.keccak256(ethers.utils.solidityPack(["address", "string"], [targetContract, method]));
};

const hasPermission = async (
  accessControl: AccessControlManager,
  targetContract: string,
  method: string,
  caller: string,
  hre: HardhatRuntimeEnvironment,
): Promise<boolean> => {
  const role = makeRole(hre.network.name === "bscmainnet", targetContract, method);
  return accessControl.hasRole(role, caller);
};

const timelockOraclePermissions = (timelock: string): AccessControlEntry[] => {
  const methods = [
    "pause()",
    "unpause()",
    "setOracle(address,address,uint8)",
    "enableOracle(address,uint8,bool)",
    "setTokenConfig(TokenConfig)",
    "setDirectPrice(address,uint256)",
    "setValidateConfig(ValidateConfig)",
    "setMaxStalePeriod(string,uint256)",
    "setSymbolOverride(string,string)",
    "setUnderlyingPythOracle(address)",
  ];
  return methods.map(method => ({
    caller: timelock,
    target: ANY_CONTRACT,
    method,
  }));
};

const configureAccessControls = async (hre: HardhatRuntimeEnvironment): Promise<GovernanceCommand[]> => {
  const networkName = hre.network.name;
  const accessControlManagerAddress = ADDRESSES[networkName].acm;

  const accessControlConfig: AccessControlEntry[] = timelockOraclePermissions(ADDRESSES[networkName].timelock);
  const accessControlManager = await ethers.getContractAt<AccessControlManager>(
    "AccessControlManager",
    accessControlManagerAddress,
  );
  const commands = await Promise.all(
    accessControlConfig.map(async (entry: AccessControlEntry) => {
      const { caller, target, method } = entry;
      if (await hasPermission(accessControlManager, caller, method, target, hre)) {
        return [];
      }
      return [
        {
          contract: accessControlManagerAddress,
          signature: "giveCallPermission(address,string,address)",
          argTypes: ["address", "string", "address"],
          parameters: [target, method, caller],
          value: 0,
        },
      ];
    }),
  );
  return commands.flat();
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const owner = ADDRESSES[hre.network.name].timelock;
  console.log(`owner: ${owner}`);
  const commands = [
    ...(await configureAccessControls(hre)),
    ...(await acceptOwnership("ResilientOracle", owner, hre)),
    ...(await acceptOwnership("ChainlinkOracle", owner, hre)),
    ...(await acceptOwnership("RedStoneOracle", owner, hre)),
    ...(await acceptOwnership("BoundValidator", owner, hre)),
    ...(await acceptOwnership("BinanceOracle", owner, hre)),
    ...(await configurePriceFeeds(hre)),
  ];

  if (hre.network.live) {
    console.log("Please propose a VIP with the following commands:");
    console.log(
      JSON.stringify(commands.map(c => ({ target: c.contract, signature: c.signature, params: c.parameters }))),
    );
  } else {
    throw Error("This script is only used for live networks.");
  }
};

func.tags = ["VIP"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name === "hardhat";

export default func;
