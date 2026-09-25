import { deployments, ethers, getNamedAccounts } from "hardhat";

export const makePairWithTokens = async (
  token1: string,
  token2: string,
  initReserves: [number, number] = [100, 100],
) => {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;
  const pair = await deploy(`PancakePairHarness-${token1}-${token2}`, {
    from: deployer,
    contract: "PancakePairHarness",
    args: [],
    autoMine: true,
    log: true,
  });
  const pairContract = await ethers.getContractAt("PancakePairHarness", pair.address);

  await pairContract.initialize(token1, token2);
  await pairContract.update(initReserves[0], initReserves[1], initReserves[0], initReserves[1]);
  return pairContract;
};
