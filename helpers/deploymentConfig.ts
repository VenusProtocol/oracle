import arbitrumoneGovernanceDeployments from "@venusprotocol/governance-contracts/deployments/arbitrumone.json";
import arbitrumsepoliaGovernanceDeployments from "@venusprotocol/governance-contracts/deployments/arbitrumsepolia.json";
import bscmainnetGovernanceDeployments from "@venusprotocol/governance-contracts/deployments/bscmainnet.json";
import bsctestnetGovernanceDeployments from "@venusprotocol/governance-contracts/deployments/bsctestnet.json";
import ethereumGovernanceDeployments from "@venusprotocol/governance-contracts/deployments/ethereum.json";
import opbnbmainnetGovernanceDeployments from "@venusprotocol/governance-contracts/deployments/opbnbmainnet.json";
import opbnbtestnetGovernanceDeployments from "@venusprotocol/governance-contracts/deployments/opbnbtestnet.json";
import sepoliaGovernanceDeployments from "@venusprotocol/governance-contracts/deployments/sepolia.json";
import zksyncsepoliaGovernanceDeployments from "@venusprotocol/governance-contracts/deployments/zksyncsepolia.json";
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

export const SEQUENCER: Record<string, string> = {
  arbitrumone: "0xFdB631F5EE196F0ed6FAa767959853A9F217697D",
  opmainnet: "0x371EAD81c9102C9BF4874A9075FFFf170F2Ee389",
};

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
    stkBNBStakePool: "0x7cdfba1ee6a8d1e688b4b34a56b62287ce400802",
    stkBNB: "0x2999C176eBf66ecda3a646E70CeB5FF4d5fCFb8C",
    BNBxStakeManager: "0xDAdcae6bF110c0e70E5624bCdcCBe206f92A2Df9",
    BNBx: "0x327d6E6FAC0228070884e913263CFF9eFed4a2C8",
    slisBNBStakeManager: "0xbF0Db0d1340fdd5DF245613E280856aEAFbF54d1",
    slisBNB: "0xd2aF6A916Bc77764dc63742BC30f71AF4cF423F4",
    WETH: "0x98f7A83361F7Ac8765CcEBAB1425da6b341958a7",
    wstETH: "0x4349016259FCd8eE452f696b2a7beeE31667D129",
    weETH: "0x7df9372096c8ca2401f30B3dF931bEFF493f1FdC",
    BTCB: "0xA808e341e8e723DC6BA0Bb5204Bafc2330d7B8e4",
    "SolvBTC.BBN": "0x8FD14481C1616d9AdA7195Be60f9d8d0994b9AE1",
    "PT-SolvBTC.BBN-27MAR2025": "0x964Ea3dC70Ee5b35Ea881cf8416B7a5F50E13f56",
  },
  bscmainnet: {
    vBNBAddress: mainnetDeployments.contracts.vBNB.address,
    WBNBAddress: mainnetDeployments.contracts.WBNB.address,
    VAIAddress: mainnetDeployments.contracts.VAI.address,
    pythOracleAddress: "0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594",
    sidRegistryAddress: "0x08CEd32a7f3eeC915Ba84415e9C07a7286977956",
    acm: bscmainnetGovernanceDeployments.contracts.AccessControlManager.address,
    timelock: bscmainnetGovernanceDeployments.contracts.NormalTimelock.address,
    PTOracle: "0x9a9fa8338dd5e5b2188006f1cd2ef26d921650c2",
    BNBxStakeManager: "0x3b961e83400D51e6E1AF5c450d3C7d7b80588d28",
    BNBx: "0x1bdd3cf7f79cfb8edbb955f20ad99211551ba275",
    stkBNBStakePool: "0xC228CefDF841dEfDbD5B3a18dFD414cC0dbfa0D8",
    stkBNB: "0xc2E9d07F66A89c44062459A47a0D2Dc038E4fb16",
    slisBNBStakeManager: "0x1adB950d8bB3dA4bE104211D5AB038628e477fE6",
    slisBNB: "0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B",
    wBETH: "0xa2e3356610840701bdf5611a53974510ae27e2e1",
    ankrBNB: "0x52f24a5e03aee338da5fd9df68d2b6fae1178827",
    WETH: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
    wstETH: "0x26c5e01524d2E6280A48F2c50fF6De7e52E9611C",
    weETH: "0x04c0599ae5a44757c0af6f9ec3b93da8976c150a",
    BTCB: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
    "SolvBTC.BBN": "0x1346b618dC92810EC74163e4c27004c921D446a5",
    "PT-SolvBTC.BBN-27MAR2025": "0x541b5eeac7d4434c8f87e2d32019d67611179606",
    "PT-SolvBTC.BBN-27MAR2025_Market": "0x9dAA2878A8739E66e08e7ad35316C5143c0ea7C7",
  },
  sepolia: {
    vBNBAddress: ethers.constants.AddressZero,
    WBNBAddress: ethers.constants.AddressZero,
    stETHAddress: "0xF5465B70Af90AEb26Aa13b1000a8CbEA53a5f4cf",
    wstETHAddress: "0x9b87ea90fdb55e1a0f17fbeddcf7eb0ac4d50493",
    VAIAddress: ethers.constants.AddressZero,
    acm: sepoliaGovernanceDeployments.contracts.AccessControlManager.address,
    timelock: "0x94fa6078b6b8a26f0b6edffbe6501b22a10470fb", // Sepolia Multisig
    weETH: "0x3b8b6E96e57f0d1cD366AaCf4CcC68413aF308D0",
    eETH: "0x0012875a7395a293Adfc9b5cDC2Cfa352C4cDcD3",
    WETH: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    PTweETH_26DEC2024: "0x56107201d3e4b7Db92dEa0Edb9e0454346AEb8B5",
    FRAX: "0x10630d59848547c9F59538E2d8963D63B912C075",
    sfrxETH: "0x14AECeEc177085fd09EA07348B4E1F7Fcc030fA1",
    rsETH: "0xfA0614E5C803E15070d31f7C38d2d430EBe68E47",
    ezETH: "0xB8eb706b85Ae7355c9FE4371a499F50f3484809c",
    weETHs: "0xE233527306c2fa1E159e251a2E5893334505A5E0",
    eBTC: "0xd48392CCf3fe028023D0783E570DFc71996859d7",
    WBTC: "0x92A2928f5634BEa89A195e7BeCF0f0FEEDAB885b",
    pufETH: "0x6D9f78b57AEeB0543a3c3B32Cc038bFB14a4bA68",
    LBTC: "0x37798CaB3Adde2F4064afBc1C7F9bbBc6A826375",
    PTUSDe_27MAR2025: "0x74671106a04496199994787B6BcB064d08afbCCf",
    USDe: "0x8bAe3E12870a002A0D4b6Eb0F0CBf91b29d9806F",
    PTsUSDe_27MAR2025: "0x3EBa2Aa29eC2498c2124523634324d4ce89c8579",
    sUSDe: "0xA3A3e5ecEA56940a4Ae32d0927bfd8821DdA848A",
    USDS: "0xfB287f9A45E54df6AADad95C6F37b1471e744762",
    sUSDS: "0xE9E34fd81982438E96Bd945f5810F910e35F0165",
    yvUSDC_1: "0x9fE6052B9534F134171F567dAC9c9B22556c1DDb",
    yvUSDT_1: "0x5cBA66C5415E56CC0Ace55148ffC63f61327478B",
    yvUSDS_1: "0xC6A0e98B8D9E9F1160E9cE1f2E0172F41FB06BC2",
    yvWETH_1: "0x99AD7ecf9b1C5aC2A11BB00D7D8a7C54fCd41517",
    USDC: "0x772d68929655ce7234C8C94256526ddA66Ef641E",
    USDT: "0x8d412FD0bc5d826615065B931171Eed10F5AF266"
  },
  ethereum: {
    vBNBAddress: ethers.constants.AddressZero,
    WBNBAddress: ethers.constants.AddressZero,
    stETHAddress: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
    wstETHAddress: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
    VAIAddress: ethers.constants.AddressZero,
    acm: ethereumGovernanceDeployments.contracts.AccessControlManager.address,
    timelock: "0x285960C5B22fD66A736C7136967A3eB15e93CC67", // Ethereum Multisig
    sFRAX: "0xA663B02CF0a4b149d2aD41910CB81e23e1c41c32",
    sfrxETH: "0xac3e018457b222d93114458476f3e3416abbe38f",
    FRAX: "0x853d955aCEf822Db058eb8505911ED77F175b99e",
    frxETH: "0x5e8422345238f34275888049021821e8e08caa1f",
    weETH: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",
    eETH: "0x35fA164735182de50811E8e2E824cFb9B6118ac2",
    PTweETH_26DEC2024: "0x6ee2b5e19ecba773a352e5b21415dc419a700d1d",
    PTweETH_26DEC2024_Market: "0x7d372819240d14fb477f17b964f95f33beb4c704",
    PTOracle: "0x9a9fa8338dd5e5b2188006f1cd2ef26d921650c2",
    EtherFiLiquidityPool: "0x308861A430be4cce5502d0A12724771Fc6DaF216",
    WETH: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    SfrxEthFraxOracle: "0x3d3D868522b5a4035ADcb67BF0846D61597A6a6F",
    rsETH: "0xA1290d69c65A6Fe4DF752f95823fae25cB99e5A7",
    ezETH: "0xbf5495Efe5DB9ce00f80364C8B423567e58d2110",
    weETHs: "0x917ceE801a67f933F2e6b33fC0cD1ED2d5909D88",
    weETHs_Accountant: "0xbe16605B22a7faCEf247363312121670DFe5afBE",
    eBTC: "0x657e8c867d8b37dcc18fa4caead9c45eb088c642",
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    eBTC_Accountant: "0x1b293DC39F94157fA0D1D36d7e0090C8B8B8c13F",
    pufETH: "0xD9A442856C234a39a81a089C06451EBAa4306a72",
    LBTC: "0x8236a87084f8B84306f72007F36F2618A5634494",
    PTUSDe_27MAR2025_Market: "0xB451A36c8B6b2EAc77AD0737BA732818143A0E25",
    PTUSDe_27MAR2025: "0x8a47b431a7d947c6a3ed6e42d501803615a97eaa",
    USDe: "0x4c9edd5852cd905f086c759e8383e09bff1e68b3",
    PTsUSDe_27MAR2025_Market: "0xcDd26Eb5EB2Ce0f203a84553853667aE69Ca29Ce",
    PTsUSDe_27MAR2025: "0xe00bd3df25fb187d6abbb620b3dfd19839947b81",
    sUSDe: "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497",
    USDS: "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
    sUSDS: "0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD",
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
  opbnbmainnet: {
    vBNBAddress: ethers.constants.AddressZero,
    WBNBAddress: ethers.constants.AddressZero,
    VAIAddress: ethers.constants.AddressZero,
    sidRegistryAddress: ethers.constants.AddressZero,
    feedRegistryAddress: "0x72d55658242377AF22907b6E7350148288f88033",
    acm: opbnbmainnetGovernanceDeployments.contracts.AccessControlManager.address,
    timelock: "0xC46796a21a3A9FAB6546aF3434F2eBfFd0604207", // opBNB Multisig
  },
  arbitrumsepolia: {
    vBNBAddress: ethers.constants.AddressZero,
    WBNBAddress: ethers.constants.AddressZero,
    VAIAddress: ethers.constants.AddressZero,
    acm: arbitrumsepoliaGovernanceDeployments.contracts.AccessControlManager.address,
    timelock: "0x1426A5Ae009c4443188DA8793751024E358A61C2", // Arbitrum Sepolia Multisig
    wstETH: "0x4A9dc15aA6094eF2c7eb9d9390Ac1d71f9406fAE",
    weETH: "0x243141DBff86BbB0a082d790fdC21A6ff615Fa34",
    WETH: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
  },
  arbitrumone: {
    vBNBAddress: ethers.constants.AddressZero,
    WBNBAddress: ethers.constants.AddressZero,
    VAIAddress: ethers.constants.AddressZero,
    acm: arbitrumoneGovernanceDeployments.contracts.AccessControlManager.address,
    timelock: "0x14e0E151b33f9802b3e75b621c1457afc44DcAA0", // Arbitrum One Multisig
    wstETH: "0x5979D7b546E38E414F7E9822514be443A4800529",
    weETH: "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe",
    WETH: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
  },
  zksyncsepolia: {
    vBNBAddress: ethers.constants.AddressZero,
    WBNBAddress: ethers.constants.AddressZero,
    VAIAddress: ethers.constants.AddressZero,
    acm: zksyncsepoliaGovernanceDeployments.contracts.AccessControlManager.address,
    timelock: "0xa2f83de95E9F28eD443132C331B6a9C9B7a9F866", // Zksync sepolia Multisig
    USDM: "0x5d5334dBa9C727eD81b549b6106aE37Ea137076D",
    wUSDM: "0x0b3C8fB109f144f6296bF4Ac52F191181bEa003a",
  },
  zksyncmainnet: {
    vBNBAddress: ethers.constants.AddressZero,
    WBNBAddress: ethers.constants.AddressZero,
    VAIAddress: ethers.constants.AddressZero,
    acm: "0x526159A92A82afE5327d37Ef446b68FD9a5cA914", // To-do: use node modules
    timelock: "0x751Aa759cfBB6CE71A43b48e40e1cCcFC66Ba4aa", // Zksync mainnet Multisig
    USDM: "0x7715c206A14Ac93Cb1A6c0316A6E5f8aD7c9Dc31",
    wUSDM: "0xA900cbE7739c96D2B153a273953620A701d5442b",
  },
  opsepolia: {
    vBNBAddress: ethers.constants.AddressZero,
    WBNBAddress: ethers.constants.AddressZero,
    VAIAddress: ethers.constants.AddressZero,
    acm: "0x1652E12C8ABE2f0D84466F0fc1fA4286491B3BC1",
    timelock: "0xd57365EE4E850e881229e2F8Aa405822f289e78d", // OpSepolia Multisig
  },
  opmainnet: {
    vBNBAddress: ethers.constants.AddressZero,
    WBNBAddress: ethers.constants.AddressZero,
    VAIAddress: ethers.constants.AddressZero,
    acm: "0xD71b1F33f6B0259683f11174EE4Ddc2bb9cE4eD6",
    timelock: "0x2e94dd14E81999CdBF5deDE31938beD7308354b3", // OpMainnet Multisig
  },
  basesepolia: {
    acm: "0x724138223D8F76b519fdE715f60124E7Ce51e051",
    vBNBAddress: ethers.constants.AddressZero,
    WBNBAddress: ethers.constants.AddressZero,
    VAIAddress: ethers.constants.AddressZero,
    WETH: "0x4200000000000000000000000000000000000006",
    wsuperOETHb: "0x02B1136d9E223333E0083aeAB76bC441f230a033",
    timelock: "0xdf3b635d2b535f906BB02abb22AED71346E36a00", // Base sepolia Multisig
  },
  basemainnet: {
    acm: "0x9E6CeEfDC6183e4D0DF8092A9B90cDF659687daB",
    vBNBAddress: ethers.constants.AddressZero,
    WBNBAddress: ethers.constants.AddressZero,
    VAIAddress: ethers.constants.AddressZero,
    WETH: "0x4200000000000000000000000000000000000006",
    wsuperOETHb: "0x7FcD174E80f264448ebeE8c88a7C4476AAF58Ea6",
    timelock: "0x1803Cf1D3495b43cC628aa1d8638A981F8CD341C", // Base mainnet Multisig
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
    CRV: "0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f",
    crvUSD: "0xEEf0C605546958c1f899b6fB336C20671f9cD49F",
    stETH: "0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8",
  },
  arbitrumsepolia: {
    WBTC: "0x56a43EB56Da12C0dc1D972ACb089c06a5dEF8e69",
    USDC: "0x0153002d20B96532C639313c2d54c3dA09109309",
    USDT: "0x80EDee6f667eCc9f63a0a6f55578F870651f06A4",
    ARB: "0xD1092a65338d049DB68D7Be6bD89d17a0929945e",
    WETH: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165",
  },
  arbitrumone: {
    WBTC: "0x6ce185860a4963106506C203335A2910413708e9",
    USDC: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3",
    USDT: "0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7",
    ARB: "0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6",
    WETH: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
    wstETH: "0xB1552C5e96B312d0Bf8b554186F846C40614a540",
    weETH: "0x20bAe7e1De9c596f5F7615aeaa1342Ba99294e12",
  },
  zksyncsepolia: {
    WBTC: "0x95Bc57e794aeb02E4a16eff406147f3ce2531F83",
    WETH: "0xfEefF7c3fB57d18C5C6Cdd71e45D2D0b4F9377bF",
    "USDC.e": "0x1844478CA634f3a762a2E71E3386837Bd50C947F",
    USDT: "0x07F05C2aFeb54b68Ea425CAbCcbF53E2d5605d76",
  },
  zksyncmainnet: {
    WBTC: "0x4Cba285c15e3B540C474A114a7b135193e4f1EA6",
    WETH: "0x6D41d1dc818112880b40e26BD6FD347E41008eDA",
    "USDC.e": "0x1824D297C6d6D311A204495277B63e943C2D376E",
    USDT: "0xB615075979AE1836B476F651f1eB79f0Cd3956a9",
  },
  opsepolia: {
    WBTC: "0x3015aa11f5c2D4Bd0f891E708C8927961b38cE7D",
    WETH: "0x61Ec26aA57019C486B10502285c5A3D4A4750AD7",
    USDC: "0x6e44e50E3cc14DD16e01C590DC1d7020cb36eD4C",
    USDT: "0xF83696ca1b8a266163bE252bE2B94702D4929392",
    OP: "0x8907a105E562C9F3d7F2ed46539Ae36D87a15590",
  },
  opmainnet: {
    WBTC: "0xD702DD976Fb76Fffc2D3963D037dfDae5b04E593",
    WETH: "0x13e3Ee699D1909E989722E753853AE30b17e08c5",
    USDC: "0x16a9FA2FDa030272Ce99B29CF780dFA30361E0f3",
    USDT: "0xECef79E109e997bCA29c1c0897ec9d7b03647F5E",
    OP: "0x0D276FC14719f9292D5C1eA2198673d1f4269246",
  },
  basesepolia: {
    USDC: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165",
    cbBTC: "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298",
    WETH: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
  },
  basemainnet: {
    USDC: "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B",
    cbBTC: "0x07DA0E54543a844a80ABE69c8A12F22B3aA59f9D",
    WETH: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
  },
};

export const redstoneFeed: Config = {
  bsctestnet: {},
  sepolia: {
    XVS: "0x0d7697a15bce933cE8671Ba3D60ab062dA216C60",
  },
  ethereum: {
    XVS: "0xa2a8507DEb233ceE4F5594044C259DD0582339CC",
  },
  arbitrumone: {
    XVS: "0xd9a66Ff1D660aD943F48e9c606D09eA672f312E8",
  },
  zksyncmainnet: {
    XVS: "0xca4793Eeb7a837E30884279b3D557970E444EBDe",
    ZK: "0x5efDb74da192584746c96EcCe138681Ec1501218",
  },
  opmainnet: {
    XVS: "0x414F8f961969A8131AbE53294600c6C515E68f81",
  },
  basemainnet: {
    XVS: "0x5ED849a45B4608952161f45483F4B95BCEa7f8f0",
  },
};

export const pythID: Config = {
  bsctestnet: {
    AUTO: "0xd954e9a88c7f97b4645b535869aba8a1e50697270a0afb09891accc031f03880",
  },
};

export const assets: Assets = {
  hardhat: [
    {
      token: "BNX",
      address: "",
      oracle: "chainlinkFixed",
      price: "159990000000000000000",
    },
    {
      token: "BTCB",
      address: "",
      oracle: "chainlinkFixed",
      price: "208000000000000000",
    },
    {
      token: "XVS",
      address: "",
      oracle: "chainlinkFixed",
      price: "208000000000000000",
    },
    {
      token: "ANKR",
      address: "",
      oracle: "chainlinkFixed",
      price: "159990000000000000000",
    },
    {
      token: "ankrBNB",
      address: "",
      oracle: "chainlinkFixed",
      price: "159990000000000000000",
    },
    {
      token: "MBOX",
      address: "",
      oracle: "chainlinkFixed",
      price: "159990000000000000000",
    },
    {
      token: "NFT",
      address: "",
      oracle: "chainlinkFixed",
      price: "159990000000000000000",
    },
    {
      token: "RACA",
      address: "",
      oracle: "chainlinkFixed",
      price: "159990000000000000000",
    },
    {
      token: "stkBNB",
      address: "",
      oracle: "chainlinkFixed",
      price: "159990000000000000000",
    },
    {
      token: "USDD",
      address: "",
      oracle: "chainlinkFixed",
      price: "159990000000000000000",
    },
  ],
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
    },
    {
      token: "WETH",
      address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
      oracle: "chainlink",
    },
    {
      token: "USDC",
      address: "0x772d68929655ce7234C8C94256526ddA66Ef641E",
      oracle: "chainlink",
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
      token: "stETH",
      address: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
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
    {
      token: "XVS",
      address: "0xd3CC9d8f3689B83c91b7B59cAB4946B063EB894A",
      oracle: "redstone",
      stalePeriod: STALE_PERIOD_26H,
    },
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
    },
    {
      token: "ETH",
      address: "0x94680e003861D43C6c0cf18333972312B6956FF1",
      oracle: "binance",
    },
    {
      token: "USDT",
      address: "0x8ac9B3801D0a8f5055428ae0bF301CA1Da976855",
      oracle: "binance",
    },
    {
      token: "WBNB",
      address: "0xF9ce72611a1BE9797FdD2c995dB6fB61FD20E4eB",
      oracle: "binance",
    },
    {
      token: "XVS",
      address: "0x3d0e20D4caD958bc848B045e1da19Fe378f86f03",
      oracle: "binance",
    },
  ],
  opbnbmainnet: [
    {
      token: "BTCB",
      address: "0x7c6b91d9be155a6db01f749217d76ff02a7227f2",
      oracle: "binance",
    },
    {
      token: "ETH",
      address: "0xe7798f023fc62146e8aa1b36da45fb70855a77ea",
      oracle: "binance",
    },
    {
      token: "USDT",
      address: "0x9e5aac1ba1a2e6aed6b32689dfcf62a509ca96f3",
      oracle: "binance",
    },
    {
      token: "WBNB",
      address: "0x4200000000000000000000000000000000000006",
      oracle: "binance",
    },
    {
      token: "XVS",
      address: "0x3E2e61F1c075881F3fB8dd568043d8c221fd5c61",
      oracle: "binance",
    },
    {
      token: "FDUSD",
      address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
      oracle: "binance",
    },
  ],
  arbitrumsepolia: [
    {
      token: "WBTC",
      address: "0xFb8d93FD3Cf18386a5564bb5619cD1FdB130dF7D",
      oracle: "chainlink",
    },
    {
      token: "USDC",
      address: "0x86f096B1D970990091319835faF3Ee011708eAe8",
      oracle: "chainlink",
    },
    {
      token: "USDT",
      address: "0xf3118a17863996B9F2A073c9A66Faaa664355cf8",
      oracle: "chainlink",
    },
    {
      token: "ARB",
      address: "0x4371bb358aB5cC192E481543417D2F67b8781731",
      oracle: "chainlink",
    },
    {
      token: "WETH",
      address: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
      oracle: "chainlink",
    },
    {
      token: "XVS",
      address: "0x877Dc896e7b13096D3827872e396927BbE704407",
      price: "10000000000000000000",
      oracle: "chainlinkFixed",
    },
    {
      token: "wstETH",
      address: "0x4A9dc15aA6094eF2c7eb9d9390Ac1d71f9406fAE",
      oracle: "chainlink",
    },
    {
      token: "weETH",
      address: "0x243141DBff86BbB0a082d790fdC21A6ff615Fa34",
      oracle: "chainlink",
    },
  ],
  arbitrumone: [
    {
      token: "WBTC",
      address: "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f",
      oracle: "chainlink",
    },
    {
      token: "USDC",
      address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      oracle: "chainlink",
    },
    {
      token: "USDT",
      address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
      oracle: "chainlink",
    },
    {
      token: "ARB",
      address: "0x912ce59144191c1204e64559fe8253a0e49e6548",
      oracle: "chainlink",
    },
    {
      token: "WETH",
      address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
      oracle: "chainlink",
    },
    {
      token: "XVS",
      address: "0xc1Eb7689147C81aC840d4FF0D298489fc7986d52",
      oracle: "redstone",
    },
    {
      token: "wstETH",
      address: "0x5979D7b546E38E414F7E9822514be443A4800529",
      oracle: "chainlink",
    },
    {
      token: "weETH",
      address: "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe",
      oracle: "chainlink",
    },
  ],
  zksyncsepolia: [
    {
      token: "WBTC",
      address: "0xeF891B3FA37FfD83Ce8cC7b682E4CADBD8fFc6F0",
      oracle: "chainlink",
    },
    {
      token: "WETH",
      address: "0x53F7e72C7ac55b44c7cd73cC13D4EF4b121678e6",
      oracle: "chainlink",
    },
    {
      token: "USDC.e",
      address: "0xF98780C8a0843829f98e624d83C3FfDDf43BE984",
      oracle: "chainlink",
    },
    {
      token: "USDT",
      address: "0x9Bf62C9C6AaB7AB8e01271f0d7A401306579709B",
      oracle: "chainlink",
    },
    {
      token: "ZK",
      address: "0x8A2E9048F5d658E88D6eD89DdD1F3B5cA0250B9F",
      oracle: "chainlink",
    },
    {
      token: "XVS",
      address: "0x3AeCac43A2ebe5D8184e650403bf9F656F9D1cfA",
      oracle: "redstone",
    },
  ],
  zksyncmainnet: [
    {
      token: "WBTC",
      address: "0xbbeb516fb02a01611cbbe0453fe3c580d7281011",
      oracle: "chainlink",
    },
    {
      token: "WETH",
      address: "0x5aea5775959fbc2557cc8789bc1bf90a239d9a91",
      oracle: "chainlink",
    },
    {
      token: "USDC.e",
      address: "0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4",
      oracle: "chainlink",
    },
    {
      token: "USDT",
      address: "0x493257fd37edb34451f62edf8d2a0c418852ba4c",
      oracle: "chainlink",
    },
    {
      token: "ZK",
      address: "0x5a7d6b2f92c77fad6ccabd7ee0624e64907eaf3e",
      oracle: "redstone",
    },
    {
      token: "XVS",
      address: "0xD78ABD81a3D57712a3af080dc4185b698Fe9ac5A",
      oracle: "redstone",
    },
  ],
  opsepolia: [
    {
      token: "WBTC",
      address: "0x9f5039a86AF12AB10Ff16659eA0885bb4C04d013",
      oracle: "chainlink",
    },
    {
      token: "USDC",
      address: "0x71B49d40B10Aa76cc44954e821eB6eA038Cf196F",
      oracle: "chainlink",
    },
    {
      token: "USDT",
      address: "0x9AD0542c71c09B764cf58d38918892F3Ae7ecc63",
      oracle: "chainlink",
    },
    {
      token: "OP",
      address: "0xEC5f6eB84677F562FC568B89121C5E5C19639776",
      oracle: "chainlink",
    },
    {
      token: "WETH",
      address: "0x4200000000000000000000000000000000000006",
      oracle: "chainlink",
    },
    {
      token: "XVS",
      address: "0x789482e37218f9b26d8D9115E356462fA9A37116",
      price: "10000000000000000000",
      oracle: "redstoneFixed",
    },
  ],
  opmainnet: [
    {
      token: "WBTC",
      address: "0x68f180fcCe6836688e9084f035309E29Bf0A2095",
      oracle: "chainlink",
    },
    {
      token: "USDC",
      address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
      oracle: "chainlink",
    },
    {
      token: "USDT",
      address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      oracle: "chainlink",
    },
    {
      token: "OP",
      address: "0x4200000000000000000000000000000000000042",
      oracle: "chainlink",
    },
    {
      token: "WETH",
      address: "0x4200000000000000000000000000000000000006",
      oracle: "chainlink",
    },
    {
      token: "XVS",
      address: "0x4a971e87ad1F61f7f3081645f52a99277AE917cF",
      oracle: "redstone",
    },
  ],
  basesepolia: [
    {
      token: "USDC",
      address: "0xFa264c13d657180e65245a9C3ac8d08b9F5Fc54D",
      oracle: "chainlink",
    },
    {
      token: "cbBTC",
      address: "0x0948001047A07e38F685f9a11ea1ddB16B234af9",
      oracle: "chainlink",
    },
    {
      token: "WETH",
      address: "0x4200000000000000000000000000000000000006",
      oracle: "chainlink",
    },
    {
      token: "XVS",
      address: "0xE657EDb5579B82135a274E85187927C42E38C021",
      price: "10000000000000000000",
      oracle: "chainlinkFixed",
    },
  ],
  basemainnet: [
    {
      token: "USDC",
      address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      oracle: "chainlink",
    },
    {
      token: "cbBTC",
      address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
      oracle: "chainlink",
    },
    {
      token: "WETH",
      address: "0x4200000000000000000000000000000000000006",
      oracle: "chainlink",
    },
    {
      token: "XVS",
      address: "0xebB7873213c8d1d9913D8eA39Aa12d74cB107995",
      oracle: "redstone",
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
