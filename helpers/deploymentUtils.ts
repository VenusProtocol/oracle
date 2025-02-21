import { HardhatRuntimeEnvironment, Network } from "hardhat/types";

export const skipAllExcept = (networks: string[]) => async (hre: HardhatRuntimeEnvironment) =>
  !networks.includes(hre.network.name);

export const isMainnet = (network: Network) => network.live && !network.tags.testnet;

export const isTestnet = (network: Network) => network.live && network.tags.testnet;
