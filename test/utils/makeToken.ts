import { Signer } from "ethers";
import { artifacts, waffle } from "hardhat";

import { BEP20Harness } from "../../src/types";

export const makeToken = async (admin: Signer, name: string, symbol: string, decimals: number = 18) => {
  // make underlying
  const tokenArtifact = await artifacts.readArtifact("BEP20Harness");
  const token = <BEP20Harness>await waffle.deployContract(admin, tokenArtifact, [name, symbol, decimals]);
  await token.deployed();
  return token;
};
