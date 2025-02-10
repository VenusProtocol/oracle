import { HardhatRuntimeEnvironment } from "hardhat/types";

export const skipAllExcept = (networks: string[]) => async (hre: HardhatRuntimeEnvironment) =>
  !networks.includes(hre.network.name);
