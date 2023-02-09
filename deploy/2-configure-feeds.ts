import { BigNumber } from "ethers";
import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ResilientOracle } from "../typechain-types/contracts/ResilientOracle";
import { BoundValidator } from "../typechain-types/contracts/oracles/BoundValidator";

interface Feed {
  [key: string]: string;
}

interface Config {
  [key: string]: Feed;
}

const pythID: Config = {
  bsctestnet: {
    BNX: "0x843b251236e67259c6c82145bd68fb198c23e7cba5e26c995e39d8257fbf8eb8",
    WBTC: "0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b",
    WBNB: "0xecf553770d9b10965f8fb64771e93f5690a182edc32be4a3236e0caaa6e0581a",
    AUTO:"0xd954e9a88c7f97b4645b535869aba8a1e50697270a0afb09891accc031f03880",
    CAKE:"0x3ea98c0336f6a8506dc34567da82178f6f7a664b206ae8eaf8ab8d96721ecccc"
  },
};

const chainlinkFeed: Config = {
  bsctestnet: {
    BNX: "0xf51492DeD1308Da8195C3bfcCF4a7c70fDbF9daE",
    WBTC: "0x5741306c21795FdCBb9b265Ea0255F499DFe515C",
    BNB: "0x5741306c21795FdCBb9b265Ea0255F499DFe515C",
    CAKE:"0x81faeDDfeBc2F8Ac524327d70Cf913001732224C",
    BUSD:"0x9331b55D9830EF609A2aBCfAc0FBCE050A52fdEa",
    WBNB: "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526"
  },
};

const assets = {
  "bsctestnet": [
    {
      token: "BNX",
      address: "0xa14C236372228B6e8182748F3eBbFb4BFEEA3574",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "BUSD",
      address: "0xDAf0Bb1F83495228a7F7908386D53c50317a5765",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "WBNB",
      address: "0xd25F4aF4b718bab3794902Bcd3A40E497B0aF7c7",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "WBTC",
      address: "0xcC74951B6306cD9779fFf5aa78605bf6d450b7fd",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "AUTO",
      address: "0xD9FAc4092e795c26f5F23803FA855A975bfC9973",
      oracle: "pyth",
      price: "159990000000000000000",
    },
    {
      token: "CAKE",
      address: "0xca83b44F7EEa4ca927b6cE41A48f119458acde4C",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
  ],
};

const addr0000 = "0x0000000000000000000000000000000000000000";
const DEFAULT_STALE_PERIOD = 3600; //60 min

module.exports = async function ({ network }: HardhatRuntimeEnvironment) {
  const networkName: string = network.name === "bscmainnet" ? "bscmainnet" : "bsctestnet";

  const resilientOracle: ResilientOracle = await hre.ethers.getContract("ResilientOracle");
  const pythOracle = await hre.ethers.getContract("PythOracle");
  const chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");
  const boundValidator: BoundValidator = await hre.ethers.getContract("BoundValidator");

  for (let i = 0; i < assets[networkName].length; i++) {
    const asset = assets[networkName][i];
    console.log(`Configuring ${asset.token}`)

    let oracles = []
    let enableFlagsForOracles = []

    if (asset.oracle == "chainlink") {
      oracles = [chainlinkOracle.address, addr0000, addr0000]
      enableFlagsForOracles = [true, false, false]
    } else {
      oracles = [pythOracle.address, addr0000, addr0000]
      enableFlagsForOracles = [true, false, false]
    }
  
    if (network.live) {
      let tx;

      if (asset.oracle == "chainlink") {
        console.log(`Configuring chainlink oracle for ${asset.token}`)
        tx = await chainlinkOracle.setTokenConfig({
          asset: asset.address,
          feed: chainlinkFeed[networkName][asset.token],
          maxStalePeriod: DEFAULT_STALE_PERIOD,
        });
  
        await tx.wait(1);
      } else {
        console.log(`Configuring pyth oracle for ${asset.token}`)
        tx = await pythOracle.setTokenConfig({
          pythId: pythID[networkName][asset.token],
          asset: asset.address,
          maxStalePeriod: DEFAULT_STALE_PERIOD,
        });

        await tx.wait(1);
      }

      console.log(`Configuring resillient oracle for ${asset.token}`)
      tx = await resilientOracle.setTokenConfig({
        asset: asset.address,
        oracles: oracles,
        enableFlagsForOracles: enableFlagsForOracles,
      });

      await tx.wait(1);
    } else {
      const mock = await hre.ethers.getContract(`Mock${asset.token}`);

      console.log(`Configuring resillient oracle for ${asset.token}`)
      let tx = await resilientOracle.setTokenConfig({
        asset: mock.address,
        oracles: oracles,
        enableFlagsForOracles: enableFlagsForOracles,
      });

      tx.wait(1)

      if (asset.oracle == "chainlink") {
        console.log(`Configuring chainlink oracle for ${asset.token}`)
        tx = await chainlinkOracle.setPrice(mock.address, asset.price);
        await tx.wait(1);
      } else {
        console.log(`Configuring pyth oracle for ${asset.token}`)
        tx = await pythOracle.setPrice(mock.address, asset.price);
        await tx.wait(1);
      }
    }
  }
};

module.exports.tags = ['configure'];
