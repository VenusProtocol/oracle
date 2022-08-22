import { network, ethers } from "hardhat"

export const increaseTime = async (time: number) => {
    await network.provider.send("evm_increaseTime", [time]);
    await network.provider.send("evm_mine"); // this one will have 02:00 PM as its timestamp
}

export const getTime = async () => {
    const block = await ethers.provider.getBlock('latest');
    return block.timestamp;
}
