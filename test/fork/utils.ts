import { network } from "hardhat";

async function setForkBlock(blockNumber: number) {
  await network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: process.env[`ARCHIVE_NODE_${process.env.FORKED_NETWORK}`],
          blockNumber,
        },
      },
    ],
  });
}

export const forking = (blockNumber: number, fn: () => void) => {
  describe(`At block #${blockNumber}`, () => {
    before(async () => {
      await setForkBlock(blockNumber);
    });
    fn();
  });
};
