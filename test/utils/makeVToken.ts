import { Signer } from "ethers";
import { artifacts, waffle } from "hardhat";

import { VBEP20Harness } from "../../src/types";

export const makeVToken = async (
  admin: Signer,
  opts: { name: string; symbol: string; decimals?: number },
  underlyingOpts?: {
    symbol: string;
    decimals: number;
    name: string;
  },
) => {
  const underlyingOpts2 = underlyingOpts || {
    symbol: "underlyingSymbol",
    decimals: 18,
    name: "underlyingName",
  };
  // make underlying
  const tokenArtifact = await artifacts.readArtifact("BEP20Harness");
  const underlyingToken = await waffle.deployContract(admin, tokenArtifact, [
    underlyingOpts2.name,
    underlyingOpts2.symbol,
    underlyingOpts2.decimals,
  ]);
  await underlyingToken.deployed();
  const vTokenArtifact = await artifacts.readArtifact("VBEP20Harness");
  const vToken = await waffle.deployContract(admin, vTokenArtifact, [
    opts.name,
    opts.symbol,
    opts.decimals || 8,
    underlyingToken.address,
  ]);
  await vToken.deployed();
  return <VBEP20Harness>vToken;
};
