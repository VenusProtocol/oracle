import { Signer } from "ethers";
import { artifacts, waffle } from "hardhat";
import { BEP20Harness } from "../../src/types";
import { PancakePairHarness } from "../../src/types/contracts/test/PancakePairHarness";

export const makePairWithTokens = async (addr: Signer, token1: BEP20Harness, token2: BEP20Harness,
    initReserves: [number, number] = [100, 100]
) => {
    const pairArtifact = await artifacts.readArtifact("PancakePairHarness");
    const pair = <PancakePairHarness>await waffle.deployContract(addr, pairArtifact, []);
    await pair.deployed();
    await pair.initialize(token1.address, token2.address);
    await pair.update(initReserves[0], initReserves[1], initReserves[0], initReserves[1]);
    return pair;
}
