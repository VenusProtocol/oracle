import { deployments, ethers, getNamedAccounts } from "hardhat";

import { VBEP20Harness } from "../../typechain-types";
import { ChainlinkOracle } from "../../typechain-types/contracts/oracles/ChainlinkOracle";

export const makeChainlinkOracle = async (decimals: number, initialAnswer: number) => {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;
  const oracle = await deploy("MockV3Aggregator", {
    from: deployer,
    contract: "MockV3Aggregator",
    args: [decimals, initialAnswer],
    autoMine: true,
    log: true,
  });
  const oracleContract = await ethers.getContractAt("MockV3Aggregator", oracle.address);
  return <ChainlinkOracle>oracleContract;
};

export const makeVToken = async (name: string, symbol: string, underlying?: string) => {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;
  let underlyingToken = underlying;
  if (!underlying) {
    const token = await deploy(`MockV3Aggregator-${name}`, {
      from: deployer,
      contract: "MockV3Aggregator",
      args: [name, symbol],
      autoMine: true,
      log: true,
    });
    underlyingToken = token.address;
  }

  const vToken = await deploy(`VBep20Harness-${name}`, {
    from: deployer,
    contract: "VBep20Harness",
    args: [name, symbol, underlyingToken],
    autoMine: true,
    log: true,
  });
  const vTokenContract = await ethers.getContractAt("VBEP20Harness", vToken.address);
  return <VBEP20Harness>vTokenContract;
};
