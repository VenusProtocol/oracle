import { deployments, getNamedAccounts } from "hardhat";

export const makeToken = async (name: string, symbol: string, decimals: number = 18) => {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;
  // make underlying
  const token = await deploy(`BEP20Harness-${name}`, {
    from: deployer,
    contract: "BEP20Harness",
    args: [name, symbol, decimals],
    autoMine: true,
    log: true,
  });
  return token;
};
