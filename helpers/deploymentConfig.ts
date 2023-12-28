import bscmainnetGovernanceDeployments from "@venusprotocol/governance-contracts/deployments/bscmainnet.json";
import bsctestnetGovernanceDeployments from "@venusprotocol/governance-contracts/deployments/bsctestnet.json";
import ethereumGovernanceDeployments from "@venusprotocol/governance-contracts/deployments/ethereum.json";
import opbnbtestnetGovernanceDeployments from "@venusprotocol/governance-contracts/deployments/opbnbtestnet.json";
import sepoliaGovernanceDeployments from "@venusprotocol/governance-contracts/deployments/sepolia.json";
import mainnetDeployments from "@venusprotocol/venus-protocol/deployments/bscmainnet.json";
import testnetDeployments from "@venusprotocol/venus-protocol/deployments/bsctestnet.json";
import { Contract } from "ethers";
import { ethers } from "hardhat";

export interface Feed {
  [key: string]: string;
}

export interface Config {
  [key: string]: Feed;
}

export interface Asset {
  token: string;
  address: string;
  oracle: string;
  price?: string;
  stalePeriod?: number;
}

export interface Assets {
  [key: string]: Asset[];
}

export interface NetworkAddress {
  [key: string]: string;
}

export interface PreconfiguredAddresses {
  [key: string]: NetworkAddress;
}

export interface AccessControlEntry {
  caller: string;
  target: string;
  method: string;
}

export interface Oracle {
  oracles: [string, string, string];
  enableFlagsForOracles: [boolean, boolean, boolean];
  underlyingOracle: Contract;
  getTokenConfig?: (asset: Asset, networkName: string) => void;
  getDirectPriceConfig?: (asset: Asset) => void;
  getStalePeriodConfig?: (asset: Asset) => string[];
}

export interface Oracles {
  [key: string]: Oracle;
}

export const addr0000 = "0x0000000000000000000000000000000000000000";
export const DEFAULT_STALE_PERIOD = 24 * 60 * 60; // 24 hrs
const STALE_PERIOD_100M = 60 * 100; // 100 minutes (for pricefeeds with heartbeat of 1 hr)
const STALE_PERIOD_26H = 60 * 60 * 26; // 26 hours (pricefeeds with heartbeat of 24 hr)
export const ANY_CONTRACT = ethers.constants.AddressZero;

export const ADDRESSES: PreconfiguredAddresses = {
  bsctestnet: {
    vBNBAddress: testnetDeployments.contracts.vBNB.address,
    WBNBAddress: testnetDeployments.contracts.WBNB.address,
    VAIAddress: testnetDeployments.contracts.VAI.address,
    pythOracleAddress: "0xd7308b14BF4008e7C7196eC35610B1427C5702EA",
    sidRegistryAddress: "0xfFB52185b56603e0fd71De9de4F6f902f05EEA23",
    acm: bsctestnetGovernanceDeployments.contracts.AccessControlManager.address,
    timelock: bsctestnetGovernanceDeployments.contracts.NormalTimelock.address,
  },
  bscmainnet: {
    vBNBAddress: mainnetDeployments.contracts.vBNB.address,
    WBNBAddress: mainnetDeployments.contracts.WBNB.address,
    VAIAddress: mainnetDeployments.contracts.VAI.address,
    pythOracleAddress: "0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594",
    sidRegistryAddress: "0x08CEd32a7f3eeC915Ba84415e9C07a7286977956",
    acm: bscmainnetGovernanceDeployments.contracts.AccessControlManager.address,
    timelock: bscmainnetGovernanceDeployments.contracts.NormalTimelock.address,
  },
  sepolia: {
    vBNBAddress: ethers.constants.AddressZero,
    WBNBAddress: ethers.constants.AddressZero,
    VAIAddress: ethers.constants.AddressZero,
    acm: sepoliaGovernanceDeployments.contracts.AccessControlManager.address,
    timelock: "0x94fa6078b6b8a26f0b6edffbe6501b22a10470fb", // Sepolia Multisig
  },
  ethereum: {
    vBNBAddress: ethers.constants.AddressZero,
    WBNBAddress: ethers.constants.AddressZero,
    VAIAddress: ethers.constants.AddressZero,
    acm: ethereumGovernanceDeployments.contracts.AccessControlManager.address,
    timelock: "0x285960C5B22fD66A736C7136967A3eB15e93CC67", // Ethereum Multisig
  },
  opbnbtestnet: {
    vBNBAddress: ethers.constants.AddressZero,
    WBNBAddress: ethers.constants.AddressZero,
    VAIAddress: ethers.constants.AddressZero,
    sidRegistryAddress: ethers.constants.AddressZero,
    feedRegistryAddress: "0x338b3D0E75bc4B3127813A79C8ECBBa96A7DB70a",
    acm: opbnbtestnetGovernanceDeployments.contracts.AccessControlManager.address,
    timelock: "0xb15f6EfEbC276A3b9805df81b5FB3D50C2A62BDf", // opBNB Multisig
  },
};

export const chainlinkFeed: Config = {
  bscmainnet: {
    USDC: "0x51597f405303C4377E36123cBc172b13269EA163",
    USDT: "0xb97ad0e74fa7d920791e90258a6e2085088b4320",
    BUSD: "0xcbb98864ef56e9042e7d2efef76141f15731b82f",
    SXP: "0xe188a9875af525d25334d75f3327863b2b8cd0f1",
    XVS: "0xbf63f430a79d4036a5900c19818aff1fa710f206",
    BTCB: "0x264990fbd0a4796a3e3d8e37c4d5f87a3aca5ebf",
    ETH: "0x9ef1b8c0e4f7dc8bf5719ea496883dc6401d5b2e",
    LTC: "0x74e72f37a8c415c8f1a98ed42e78ff997435791d",
    XRP: "0x93a67d414896a280bf8ffb3b389fe3686e014fda",
    BCH: "0x43d80f616daf0b0b42a928eed32147dc59027d41",
    DOT: "0xc333eb0086309a16aa7c8308dfd32c8bba0a2592",
    LINK: "0xca236e327f629f9fc2c30a4e95775ebf0b89fac8",
    DAI: "0x132d3C0B1D2cEa0BC552588063bdBb210FDeecfA",
    FIL: "0xe5dbfd9003bff9df5feb2f4f445ca00fb121fb83",
    BETH: "0x2a3796273d47c4ed363b361d3aefb7f7e2a13782",
    ADA: "0xa767f745331D267c7751297D982b050c93985627",
    DOGE: "0x3ab0a0d137d4f946fbb19eecc6e92e64660231c8",
    MATIC: "0x7ca57b0ca6367191c94c8914d7df09a57655905f",
    CAKE: "0xb6064ed41d4f67e353768aa239ca86f4f73665a1",
    AAVE: "0xa8357bf572460fc40f4b0acacbb2a6a61c89f475",
    TUSD: "0xa3334a9762090e827413a7495afece76f41dfc06",
    TRX: "0xf4c5e535756d11994fcbb12ba8add0192d9b88be",
    TRX_OLD: "0xf4c5e535756d11994fcbb12ba8add0192d9b88be",
    BNB: "0x0567f2323251f0aab15c8dfb1967e4e8a7d42aee",
    VAI: "0x058316f8Bb13aCD442ee7A216C7b60CFB4Ea1B53",
    ALPACA: "0xe0073b60833249ffd1bb2af809112c2fbf221DF6",
    BNBx: "0xc4429B539397a3166eF3ef132c29e34715a3ABb4",
    BSW: "0x08e70777b982a58d23d05e3d7714f44837c06a21",
    WBNB: "0x0567f2323251f0aab15c8dfb1967e4e8a7d42aee",
    WIN: "0x9e7377e194e41d63795907c92c3eb351a2eb0233",
    FDUSD: "0x390180e80058a8499930f0c13963ad3e0d86bfc9",
  },
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
  sepolia: {
    WBTC: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
    WETH: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    USDC: "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E",
  },
  ethereum: {
    WBTC: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
    WETH: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    USDT: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
    USDC: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
    XVS: "0xa2a8507DEb233ceE4F5594044C259DD0582339CC",
    CRV: "0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f",
    crvUSD: "0xEEf0C605546958c1f899b6fB336C20671f9cD49F",
  },
};

export const redstoneFeed: Config = {
  bsctestnet: {},
  sepolia: {
    XVS: "0x0d7697a15bce933cE8671Ba3D60ab062dA216C60",
  },
};

export const pythID: Config = {
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
    {
      token: "FDUSD",
      address: "0xcF27439fA231af9931ee40c4f27Bb77B83826F3C",
      oracle: "chainlinkFixed",
      price: "1000000000000000000", // 1$
    },
  ],
  bscmainnet: [
    {
      token: "USDC",
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      oracle: "chainlink",
    },
    {
      token: "USDT",
      address: "0x55d398326f99059fF775485246999027B3197955",
      oracle: "chainlink",
    },
    {
      token: "BUSD",
      address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
      oracle: "chainlink",
    },
    {
      token: "SXP",
      address: "0x47BEAd2563dCBf3bF2c9407fEa4dC236fAbA485A",
      oracle: "chainlink",
    },
    {
      token: "XVS",
      address: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63",
      oracle: "chainlink",
    },
    {
      token: "BTCB",
      address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
      oracle: "chainlink",
    },
    {
      token: "ETH",
      address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
      oracle: "chainlink",
    },
    {
      token: "LTC",
      address: "0x4338665CBB7B2485A8855A139b75D5e34AB0DB94",
      oracle: "chainlink",
    },
    {
      token: "XRP",
      address: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE",
      oracle: "chainlink",
    },
    {
      token: "BCH",
      address: "0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf",
      oracle: "chainlink",
    },
    {
      token: "DOT",
      address: "0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402",
      oracle: "chainlink",
    },
    {
      token: "LINK",
      address: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD",
      oracle: "chainlink",
    },
    {
      token: "DAI",
      address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
      oracle: "chainlink",
    },
    {
      token: "FIL",
      address: "0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153",
      oracle: "chainlink",
    },
    {
      token: "BETH",
      address: "0x250632378E573c6Be1AC2f97Fcdf00515d0Aa91B",
      oracle: "chainlink",
    },
    {
      token: "ADA",
      address: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47",
      oracle: "chainlink",
    },
    {
      token: "DOGE",
      address: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43",
      oracle: "chainlink",
    },
    {
      token: "MATIC",
      address: "0xCC42724C6683B7E57334c4E856f4c9965ED682bD",
      oracle: "chainlink",
    },
    {
      token: "CAKE",
      address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
      oracle: "chainlink",
    },
    {
      token: "AAVE",
      address: "0xfb6115445Bff7b52FeB98650C87f44907E58f802",
      oracle: "chainlink",
    },
    {
      token: "TUSD",
      address: "0x14016E85a25aeb13065688cAFB43044C2ef86784",
      oracle: "chainlink",
    },
    {
      token: "TRX_OLD",
      address: "0x85EAC5Ac2F758618dFa09bDbe0cf174e7d574D5B",
      oracle: "chainlink",
    },
    {
      token: "TRX",
      address: "0xCE7de646e7208a4Ef112cb6ed5038FA6cC6b12e3",
      oracle: "chainlink",
    },
    {
      token: "BNB",
      address: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
      oracle: "chainlink",
    },
    {
      token: "VAI",
      address: "0x4BD17003473389A42DAF6a0a729f6Fdb328BbBd7",
      oracle: "chainlink",
    },
    {
      token: "ALPACA",
      address: "0x8f0528ce5ef7b51152a59745befdd91d97091d2f",
      oracle: "chainlink",
      stalePeriod: 60 * 60 * 24.5,
    },
    {
      token: "BNBx",
      address: "0x1bdd3cf7f79cfb8edbb955f20ad99211551ba275",
      oracle: "chainlink",
      stalePeriod: 60 * 25,
    },
    {
      token: "BSW",
      address: "0x965f527d9159dce6288a2219db51fc6eef120dd1",
      oracle: "chainlink",
      stalePeriod: 60 * 25,
    },
    {
      token: "WBNB",
      address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
      oracle: "chainlink",
      stalePeriod: 60 * 5,
    },
    {
      token: "WIN",
      address: "0xaeF0d72a118ce24feE3cD1d43d383897D05B4e99",
      oracle: "chainlink",
      stalePeriod: 60 * 25,
    },
    {
      token: "LUNA",
      address: "0x156ab3346823b651294766e23e6cf87254d68962",
      oracle: "chainlinkFixed",
      price: "1000000000000", // 1 atom of USD
    },
    {
      token: "UST",
      address: "0x3d4350cd54aef9f9b2c29435e0fa809957b3f30a",
      oracle: "chainlinkFixed",
      price: "1000000000000", // 1 atom of USD
    },
    {
      token: "CAN",
      address: "0x20bff4bbeda07536ff00e073bd8359e5d80d733d",
      oracle: "chainlinkFixed",
      price: "1", // 0 USD
    },
    {
      token: "ANKR",
      address: "0xf307910A4c7bbc79691fD374889b36d8531B08e3",
      oracle: "binance",
      stalePeriod: 60 * 25,
    },
    {
      token: "ankrBNB",
      address: "0x52F24a5e03aee338Da5fd9Df68D2b6FAe1178827",
      oracle: "binance",
      stalePeriod: 60 * 25,
    },
    {
      token: "BTT",
      address: "0x352Cb5E19b12FC216548a2677bD0fce83BaE434B",
      oracle: "binance",
      stalePeriod: 60 * 25,
    },
    {
      token: "FLOKI",
      address: "0xfb5B838b6cfEEdC2873aB27866079AC55363D37E",
      oracle: "binance",
      stalePeriod: 60 * 25,
    },
    {
      token: "HAY",
      address: "0x0782b6d8c4551B9760e74c0545a9bCD90bdc41E5",
      oracle: "binance",
      stalePeriod: 60 * 25,
    },
    {
      token: "NFT",
      address: "0x20eE7B720f4E4c4FFcB00C4065cdae55271aECCa",
      oracle: "binance",
      stalePeriod: 60 * 25,
    },
    {
      token: "RACA",
      address: "0x12BB890508c125661E03b09EC06E404bc9289040",
      oracle: "binance",
      stalePeriod: 60 * 25,
    },
    {
      token: "stkBNB",
      address: "0xc2E9d07F66A89c44062459A47a0D2Dc038E4fb16",
      oracle: "binance",
      stalePeriod: 60 * 25,
    },
    {
      token: "USDD",
      address: "0xd17479997F34dd9156Deef8F95A52D81D265be9c",
      oracle: "binance",
      stalePeriod: 60 * 25,
    },
    {
      token: "FDUSD",
      address: "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409",
      oracle: "chainlink", // main oracle
      stalePeriod: 60 * 60 * 24.5,
    },
    {
      token: "FDUSD",
      address: "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409",
      oracle: "binance", // pivot oracle
      stalePeriod: 60 * 25,
    },
  ],
  sepolia: [
    {
      token: "WBTC",
      address: "0x92A2928f5634BEa89A195e7BeCF0f0FEEDAB885b",
      oracle: "chainlink",
      price: "25000000000000000000000",
    },
    {
      token: "WETH",
      address: "0x700868CAbb60e90d77B6588ce072d9859ec8E281",
      oracle: "chainlink",
      price: "2080000000000000000000",
    },
    {
      token: "USDC",
      address: "0x772d68929655ce7234C8C94256526ddA66Ef641E",
      oracle: "chainlink",
      price: "1000000000000000000",
    },
    {
      token: "USDT",
      address: "0x8d412FD0bc5d826615065B931171Eed10F5AF266",
      oracle: "chainlinkFixed",
      price: "1000000000000000000",
    },
    {
      token: "XVS",
      address: "0xdb633c11d3f9e6b8d17ac2c972c9e3b05da59bf9",
      oracle: "redstone",
      price: "5000000000000000000", // $5.00
    },
    {
      token: "CRV",
      address: "0x2c78EF7eab67A6e0C9cAa6f2821929351bdDF3d3",
      oracle: "chainlinkFixed",
      price: "500000000000000000", // $0.5
    },
    {
      token: "crvUSD",
      address: "0x36421d873abCa3E2bE6BB3c819C0CF26374F63b6",
      oracle: "chainlinkFixed",
      price: "1000000000000000000", // $1.00
    },
  ],
  ethereum: [
    {
      token: "WBTC",
      address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
      oracle: "chainlink",
      stalePeriod: STALE_PERIOD_100M,
    },
    {
      token: "WETH",
      address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      oracle: "chainlink",
      stalePeriod: STALE_PERIOD_100M,
    },
    {
      token: "USDC",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      oracle: "chainlink",
      stalePeriod: STALE_PERIOD_26H,
    },
    {
      token: "USDT",
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      oracle: "chainlink",
      stalePeriod: STALE_PERIOD_26H,
    },
    // {
    //   token: "XVS",
    //   address: "", // TODO: add redstone address when we get it
    //   oracle: "redstone",
    //   stalePeriod: STALE_PERIOD_26H
    // },
    {
      token: "CRV",
      address: "0xD533a949740bb3306d119CC777fa900bA034cd52",
      oracle: "chainlink",
      stalePeriod: STALE_PERIOD_26H,
    },
    {
      token: "crvUSD",
      address: "0xf939e0a03fb07f59a73314e73794be0e57ac1b4e",
      oracle: "chainlink",
      stalePeriod: STALE_PERIOD_26H,
    },
  ],
  opbnbtestnet: [
    {
      token: "BTCB",
      address: "0x7Af23F9eA698E9b953D2BD70671173AaD0347f19",
      oracle: "binance",
      price: "35000000000000000000000",
    },
    {
      token: "ETH",
      address: "0x94680e003861D43C6c0cf18333972312B6956FF1",
      oracle: "binance",
      price: "2000000000000000000000",
    },
    {
      token: "USDT",
      address: "0x8ac9B3801D0a8f5055428ae0bF301CA1Da976855",
      oracle: "binance",
      price: "1000000000000000000",
    },
    {
      token: "WBNB",
      address: "0xF9ce72611a1BE9797FdD2c995dB6fB61FD20E4eB",
      oracle: "binance",
      price: "230000000000000000000",
    },
    {
      token: "XVS",
      address: "0x3d0e20D4caD958bc848B045e1da19Fe378f86f03",
      oracle: "binance",
      price: "7000000000000000000",
    },
  ],
};

export const getOraclesData = async (): Promise<Oracles> => {
  const chainlinkOracle = await ethers.getContractOrNull("ChainlinkOracle");
  const redstoneOracle = await ethers.getContractOrNull("RedStoneOracle");
  const binanceOracle = await ethers.getContractOrNull("BinanceOracle");
  const pythOracle = await ethers.getContractOrNull("PythOracle");

  const oraclesData: Oracles = {
    ...(chainlinkOracle
      ? {
          chainlink: {
            oracles: [chainlinkOracle.address, addr0000, addr0000],
            enableFlagsForOracles: [true, false, false],
            underlyingOracle: chainlinkOracle,
            getTokenConfig: (asset: Asset, name: string) => ({
              asset: asset.address,
              feed: chainlinkFeed[name][asset.token],
              maxStalePeriod: asset.stalePeriod ? asset.stalePeriod : DEFAULT_STALE_PERIOD,
            }),
          },
          chainlinkFixed: {
            oracles: [chainlinkOracle.address, addr0000, addr0000],
            enableFlagsForOracles: [true, false, false],
            underlyingOracle: chainlinkOracle,
            getDirectPriceConfig: (asset: Asset) => ({
              asset: asset.address,
              price: asset.price,
            }),
          },
        }
      : {}),
    ...(redstoneOracle
      ? {
          redstone: {
            oracles: [redstoneOracle.address, addr0000, addr0000],
            enableFlagsForOracles: [true, false, false],
            underlyingOracle: redstoneOracle,
            getTokenConfig: (asset: Asset, name: string) => ({
              asset: asset.address,
              feed: redstoneFeed[name][asset.token],
              maxStalePeriod: asset.stalePeriod ? asset.stalePeriod : DEFAULT_STALE_PERIOD,
            }),
          },
        }
      : {}),
    ...(binanceOracle
      ? {
          binance: {
            oracles: [binanceOracle.address, addr0000, addr0000],
            enableFlagsForOracles: [true, false, false],
            underlyingOracle: binanceOracle,
            getStalePeriodConfig: (asset: Asset) => [
              asset.token,
              asset.stalePeriod ? asset.stalePeriod.toString() : DEFAULT_STALE_PERIOD.toString(),
            ],
          },
        }
      : {}),
    ...(pythOracle
      ? {
          pyth: {
            oracles: [pythOracle.address, addr0000, addr0000],
            enableFlagsForOracles: [true, false, false],
            underlyingOracle: pythOracle,
            getTokenConfig: (asset: Asset, name: string) => ({
              pythId: pythID[name][asset.token],
              asset: asset.address,
              maxStalePeriod: asset.stalePeriod ? asset.stalePeriod : DEFAULT_STALE_PERIOD,
            }),
          },
        }
      : {}),
  };

  return oraclesData;
};

export const getOraclesToDeploy = async (network: string): Promise<Record<string, boolean>> => {
  const oracles: Record<string, boolean> = {};

  assets[network].forEach(asset => {
    oracles[asset.oracle] = true;
  });

  return oracles;
};
