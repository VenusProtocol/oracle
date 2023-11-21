import { deployments, ethers, getNamedAccounts } from "hardhat";

import { VBEP20Harness } from "../../typechain-types";

export const makeVToken = async (
  opts: { name: string; symbol: string; decimals?: number },
  underlyingOpts?: {
    symbol: string;
    decimals?: number;
    name: string;
  },
) => {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;
  const underlyingOpts2 = underlyingOpts || {
    symbol: "underlyingSymbol",
    decimals: 18,
    name: "underlyingName",
  };
  // make underlying
  const underlyingToken = await deploy(`BEP20Harness-${underlyingOpts2.name}`, {
    from: deployer,
    contract: "BEP20Harness",
    args: [underlyingOpts2.name, underlyingOpts2.symbol, underlyingOpts2.decimals || 18],
    autoMine: true,
    log: true,
  });

  const vToken = await deploy(`VBEP20Harness-${opts.name}`, {
    from: deployer,
    contract: "VBEP20Harness",
    args: [opts.name, opts.symbol, opts.decimals || 8, underlyingToken.address],
    autoMine: true,
    log: true,
  });
  const vTokenContract = await ethers.getContractAt("VBEP20Harness", vToken.address);
  return <VBEP20Harness>vTokenContract;
};
