// this needs to come first
import "module-alias/register";

import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import { config as dotenvConfig } from "dotenv";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import { HardhatUserConfig } from "hardhat/config";
import { NetworkUserConfig } from "hardhat/types";
import { resolve } from "path";
import "solidity-coverage";

import "./tasks";

dotenvConfig({ path: resolve(__dirname, "./.env") });

// Ensure that we have all the environment variables we need.
const privateKey: string | undefined = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("Please set your PRIVATE_KEY in a .env file");
}

const infuraApiKey: string | undefined = process.env.INFURA_API_KEY;
if (!infuraApiKey) {
  throw new Error("Please set your INFURA_API_KEY in a .env file");
}

const chainIds = {
  bsc: 56,
  bsctestnet: 97,
  hardhat: 31337,
  goerli: 5,
  rinkeby: 4,
};

function getChainConfig(chain: keyof typeof chainIds): NetworkUserConfig {
  let jsonRpcUrl: string;
  switch (chain) {
    case "bsc":
      jsonRpcUrl = process.env.BSC_RPC || "https://bsc-dataseed1.binance.org";
      break;
    case "bsctestnet":
      jsonRpcUrl = process.env.BSC_TESTNET_NODE || "https://data-seed-prebsc-2-s1.binance.org:8545";
      break;
    default:
      jsonRpcUrl = "https://" + chain + ".infura.io/v3/" + infuraApiKey;
  }
  return {
    accounts: [`0x${privateKey}`],
    chainId: chainIds[chain],
    url: jsonRpcUrl,
  };
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
    },
  },
  etherscan: {
    apiKey: {
      bsc: process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      bsctestnet: process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      rinkeby: process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      goerli: process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    hardhat: {
      chainId: chainIds.hardhat,
    },
    goerli: getChainConfig("goerli"),
    rinkeby: getChainConfig("rinkeby"),
    bsc: getChainConfig("bsc"),
    bsctestnet: getChainConfig("bsctestnet"),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.13",
        settings: {
          // Disable the optimizer when debugging
          // https://hardhat.org/hardhat-network/#solidity-optimizer-support
          optimizer: {
            enabled: true,
          },
          outputSelection: {
            "*": {
              "*": ["storageLayout"],
            },
          },
        },
      },
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
          },
          outputSelection: {
            "*": {
              "*": ["storageLayout"],
            },
          },
        },
      },
    ],
  },
  typechain: {
    outDir: "src/types",
    target: "ethers-v5",
  },
};

export default config;
