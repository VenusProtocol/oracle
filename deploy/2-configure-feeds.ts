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
  getStalePeriodConfig?: (asset: Asset) => string[];
}

interface Oracles {
  [key: string]: Oracle;
}

const chainlinkFeed: Config = {
  bsctestnet: {
    BNX: "0xf51492DeD1308Da8195C3bfcCF4a7c70fDbF9daE",
    BTCB: "0x5741306c21795FdCBb9b265Ea0255F499DFe515C",
    TRX: "0x135deD16bFFEB51E01afab45362D3C4be31AA2B0",
    AAVE: "0x298619601ebCd58d0b526963Deb2365B485Edc74",
    MATIC: "0x957Eb0316f02ba4a9De3D308742eefd44a3c1719",
    CAKE: "0x81faeDDfeBc2F8Ac524327d70Cf913001732224C",
    DOGE: "0x963D5e7f285Cc84ed566C486c3c1bC911291be38",
    ADA: "0x5e66a1775BbC249b5D51C13d29245522582E671C",
    BTC: "0x5741306c21795FdCBb9b265Ea0255F499DFe515C",
    XRP: "0x4046332373C24Aed1dC8bAd489A04E187833B28d",
    ETH: "0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7",
    XVS: "0xCfA786C17d6739CBC702693F23cA4417B5945491",
    SXP: "0x678AC35ACbcE272651874E782DB5343F9B8a7D66",
    BUSD: "0x9331b55D9830EF609A2aBCfAc0FBCE050A52fdEa",
    USDT: "0xEca2605f0BCF2BA5966372C99837b1F182d3D620",
    USDC: "0x90c069C4538adAc136E051052E14c1cD799C41B7",
    BNB: "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526",
    LTC: "0x9Dcf949BCA2F4A8a62350E0065d18902eE87Dca3",
  },
};

const pythID: Config = {
  bsctestnet: {
    AUTO: "0xd954e9a88c7f97b4645b535869aba8a1e50697270a0afb09891accc031f03880",
  },
};

export const assets: Assets = {
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
    {
      token: "TRX",
      address: "0x7D21841DC10BA1C5797951EFc62fADBBDD06704B",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "TRX", // OLD TRX
      address: "0x19E7215abF8B2716EE807c9f4b83Af0e7f92653F",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "AAVE",
      address: "0x4B7268FC7C727B88c5Fc127D41b491BfAe63e144",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "MATIC",
      address: "0xcfeb0103d4BEfa041EA4c2dACce7B3E83E1aE7E3",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "CAKE",
      address: "0xe8bd7cCC165FAEb9b81569B05424771B9A20cbEF",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "DOGE",
      address: "0x67D262CE2b8b846d9B94060BC04DC40a83F0e25B",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "ADA",
      address: "0xcD34BC54106bd45A04Ed99EBcC2A6a3e70d7210F",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "XRP",
      address: "0x3022A32fdAdB4f02281E8Fab33e0A6811237aab0",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "LTC",
      address: "0x969F147B6b8D81f86175de33206A4FD43dF17913",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "ETH",
      address: "0x98f7A83361F7Ac8765CcEBAB1425da6b341958a7",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "XVS",
      address: "0xB9e0E753630434d7863528cc73CB7AC638a7c8ff",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "SXP",
      address: "0x75107940Cf1121232C0559c747A986DEfbc69DA9",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "USDT",
      address: "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "USDC",
      address: "0x16227D60f7a0e586C66B005219dfc887D13C9531",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
    {
      token: "BNB",
      address: "0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c",
      oracle: "chainlink",
      price: "159990000000000000000",
    },
  ],
};

const addr0000 = "0x0000000000000000000000000000000000000000";
const DEFAULT_STALE_PERIOD = 24 * 60 * 60; // 24 hrs

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
      getTokenConfig: (asset: Asset, name: string) => ({
        asset: asset.address,
        feed: chainlinkFeed[name][asset.token],
        maxStalePeriod: DEFAULT_STALE_PERIOD,
      }),
    },
    binance: {
      oracles: [binanceOracle.address, addr0000, addr0000],
      enableFlagsForOracles: [true, false, false],
      underlyingOracle: binanceOracle,
      getStalePeriodConfig: (asset: Asset) => [asset.token, DEFAULT_STALE_PERIOD.toString()],
    },
    pyth: {
      oracles: [pythOracle.address, addr0000, addr0000],
      enableFlagsForOracles: [true, false, false],
      underlyingOracle: pythOracle,
      getTokenConfig: (asset: Asset, name: string) => ({
        pythId: pythID[name][asset.token],
        asset: asset.address,
        maxStalePeriod: DEFAULT_STALE_PERIOD,
      }),
    },
  };

  for (const asset of assets[networkName]) {
    const { oracle } = asset;
    console.log(`Configuring ${asset.token}`);

    if (network.live) {
      console.log(`Configuring ${oracle} oracle for ${asset.token}`);

      const { getTokenConfig } = oraclesData[oracle];
      if (oraclesData[oracle].underlyingOracle.address !== binanceOracle.address && getTokenConfig !== undefined) {
        const tx = await oraclesData[oracle].underlyingOracle?.setTokenConfig(getTokenConfig(asset, networkName));
        tx.wait(1);
      }

      const { getStalePeriodConfig } = oraclesData[oracle];
      if (oraclesData[oracle].underlyingOracle.address === binanceOracle.address && getStalePeriodConfig !== undefined) {
        const tx = await oraclesData[oracle].underlyingOracle?.setTokenConfig(...getStalePeriodConfig(asset));
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
      const MockToken = await hre.ethers.getContractFactory("BEP20Harness");
      const mock = await MockToken.deploy(`Mock${asset.token}`, `Mock${asset.token}`, 18);

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

export default func;
export const tags = ["configure"];
