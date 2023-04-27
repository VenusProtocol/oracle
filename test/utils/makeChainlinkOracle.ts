import { Signer } from "ethers";
import { artifacts, waffle } from "hardhat";

import { VBEP20Harness } from "../../typechain-types";
import { ChainlinkOracle } from "../../typechain-types/contracts/oracles/ChainlinkOracle";

export const makeChainlinkOracle = async (admin: Signer, decimals: number, initialAnswer: number) => {
  const oracleArtifact = await artifacts.readArtifact("MockV3Aggregator");
  const oracle = await waffle.deployContract(admin, oracleArtifact, [decimals, initialAnswer]);
  await oracle.deployed();
  return <ChainlinkOracle>oracle;
};

export const makeVToken = async (admin: Signer, name: string, symbol: string, underlying?: string) => {
  let token;
  let underlyingToken = underlying;
  if (!underlying) {
    const tokenArtifact = await artifacts.readArtifact("Bep20Harness");
    token = await waffle.deployContract(admin, tokenArtifact, [name, symbol]);
    await token.deployed();
    underlyingToken = token.address;
  }
  const vTokenArtifact = await artifacts.readArtifact("VBep20Harness");
  const vToken = await waffle.deployContract(admin, vTokenArtifact, [name, symbol, underlyingToken]);
  await vToken.deployed();
  return <VBEP20Harness>vToken;
};
