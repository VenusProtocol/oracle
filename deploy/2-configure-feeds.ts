import { Contract } from "ethers";
import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

interface Feed {
  [key: string]: string;
}

interface Config {
  [key: string]: Feed;
}

interface Asset {
  token: string;
  address: string;
  oracle: string;
  price: string;
}

interface Assets {
  [key: string]: Asset[];
}

interface Oracle {
  oracles: [string, string, string];
  enableFlagsForOracles: [boolean, boolean, boolean];
  underlyingOracle: Contract;
  getTokenConfig?: (asset: Asset, networkName: string) => void;
}

interface Oracles {
  [key: string]: Oracle;
}

const chainlinkFeed: Config = {
  bsctestnet: {
    BNX: "0xf51492DeD1308Da8195C3bfcCF4a7c70fDbF9daE",
    BTCB: "0x5741306c21795FdCBb9b265Ea0255F499DFe515C",
  },
};

const pythID: Config = {
  bsctestnet: {
    AUTO: "0xd954e9a88c7f97b4645b535869aba8a1e50697270a0afb09891accc031f03880",
  },
};

const assets: Assets = {
  bsctestnet: [
    {
      token: "BNX",
      address: "0xa8062D2bd49D1D2C6376B444bde19402B38938d0",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "BTCB",
      address: "0xA808e341e8e723DC6BA0Bb5204Bafc2330d7B8e4",
      oracle: "chainlink",
      price: "208000000000000000",
    },
    {
      token: "XVS",
      address: "0xB9e0E753630434d7863528cc73CB7AC638a7c8ff",
      oracle: "binance",
      price: "208000000000000000",
    },
    {
      token: "BUSD",
      address: "0x8301F2213c0eeD49a7E28Ae4c3e91722919B8B47",
      oracle: "binance",
      price: "159990000000000000000",
    },
    {
      token: "ANKR",
      address: "0xe4a90EB942CF2DA7238e8F6cC9EF510c49FC8B4B",
      oracle: "binance",
      price: "159990000000000000000",
    },
    {
      token: "ankrBNB",
      address: "0x167F1F9EF531b3576201aa3146b13c57dbEda514",
      oracle: "binance",
      price: "159990000000000000000",
    },
    {
      token: "MBOX",
      address: "0x523027fFdf9B18Aa652dBcd6B92f885009153dA3",
      oracle: "binance",
      price: "159990000000000000000",
    },
    {
      token: "NFT",
      address: "0xc440e4F21AFc2C3bDBA1Af7D0E338ED35d3e25bA",
      oracle: "binance",
      price: "159990000000000000000",
    },
    {
      token: "RACA",
      address: "0xD60cC803d888A3e743F21D0bdE4bF2cAfdEA1F26",
      oracle: "binance",
      price: "159990000000000000000",
    },
    {
      token: "stkBNB",
      address: "0x2999C176eBf66ecda3a646E70CeB5FF4d5fCFb8C",
      oracle: "binance",
      price: "159990000000000000000",
    },
    {
      token: "USDD",
      address: "0x2E2466e22FcbE0732Be385ee2FBb9C59a1098382",
      oracle: "binance",
      price: "159990000000000000000",
    },
    {
      token: "AUTO",
      address: "0xD9FAc4092e795c26f5F23803FA855A975bfC9973",
      oracle: "pyth",
      price: "159990000000000000000",
    },
  ],
};

const addr0000 = "0x0000000000000000000000000000000000000000";
const DEFAULT_STALE_PERIOD = 3600; //60 min

const func: DeployFunction = async function ({ network }: HardhatRuntimeEnvironment) {
  const networkName: string = network.name === "bscmainnet" ? "bscmainnet" : "bsctestnet";

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");
  const binanceOracle = await hre.ethers.getContract("BinanceOracle");
  const chainlinkOracle = await hre.ethers.getContract("ChainlinkOracle");
  const pythOracle = await hre.ethers.getContract("PythOracle");

  const oraclesData: Oracles = {
    chainlink: {
      oracles: [chainlinkOracle.address, addr0000, addr0000],
      enableFlagsForOracles: [true, false, false],
      underlyingOracle: chainlinkOracle,
      getTokenConfig: (asset: Asset, networkName: string) => ({
        asset: asset.address,
        feed: chainlinkFeed[networkName][asset.token],
        maxStalePeriod: DEFAULT_STALE_PERIOD,
      }),
    },
    binance: {
      oracles: [binanceOracle.address, addr0000, addr0000],
      enableFlagsForOracles: [true, false, false],
      underlyingOracle: binanceOracle,
    },
    pyth: {
      oracles: [pythOracle.address, addr0000, addr0000],
      enableFlagsForOracles: [true, false, false],
      underlyingOracle: pythOracle,
      getTokenConfig: (asset: Asset, networkName: string) => ({
        pythId: pythID[networkName][asset.token],
        asset: asset.address,
        maxStalePeriod: DEFAULT_STALE_PERIOD,
      }),
    },
  };

  for (let i = 0; i < assets[networkName].length; i++) {
    const asset = assets[networkName][i];
    const oracle = asset.oracle;
    console.log(`Configuring ${asset.token}`);

    if (network.live) {
      console.log(`Configuring ${oracle} oracle for ${asset.token}`);

      const getTokenConfig = oraclesData[oracle].getTokenConfig;
      if (oraclesData[oracle].underlyingOracle.address != binanceOracle.address && getTokenConfig != undefined) {
        const tx = await oraclesData[oracle].underlyingOracle?.setTokenConfig(getTokenConfig(asset, networkName));
        tx.wait(1);
      }

      console.log(`Configuring resillient oracle for ${asset.token}`);
      const tx = await resilientOracle.setTokenConfig({
        asset: asset.address,
        oracles: oraclesData[oracle].oracles,
        enableFlagsForOracles: oraclesData[oracle].enableFlagsForOracles,
      });

      await tx.wait(1);
    } else {
      const mock = await hre.ethers.getContract(`Mock${asset.token}`);

      console.log(`Configuring resillient oracle for ${asset.token}`);
      let tx = await resilientOracle.setTokenConfig({
        asset: mock.address,
        oracles: oraclesData[oracle].oracles,
        enableFlagsForOracles: oraclesData[oracle].enableFlagsForOracles,
      });

      await tx.wait(1);

      console.log(`Configuring ${oracle} oracle for ${asset.token}`);
      tx = await oraclesData[oracle].underlyingOracle?.setPrice(mock.address, asset.price);
      await tx.wait(1);
    }
  }
};

module.exports = func;
module.exports.tags = ["configure"];
