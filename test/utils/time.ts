import { network } from "hardhat"

export const increaseTime = async (time: number) => {
    await network.provider.send("evm_increaseTime", [time]);
    await network.provider.send("evm_mine"); // this one will have 02:00 PM as its timestamp
}
