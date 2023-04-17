import "module-alias/register";

import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import * as dotenv from "dotenv";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import { HardhatUserConfig } from "hardhat/config";
import "solidity-coverage";
import "solidity-docgen";

import "./tasks";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.13",
        settings: {
          optimizer: {
            enabled: true,
            details: {
              yul: !process.env.CI,
            },
          },
          outputSelection: {
            "*": {
              "*": ["storageLayout"],
            },
          },
        },
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            details: {
              yul: !process.env.CI,
            },
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
  networks: {
    hardhat: isFork(),
    development: {
      url: "http://127.0.0.1:8545/",
      chainId: 31337,
      live: false,
    },
    bsctestnet: {
      url: "https://bsc-testnet.public.blastapi.io",
      chainId: 97,
      live: true,
      gasPrice: 20000000000,
      accounts: {
        mnemonic: process.env.MNEMONIC || "",
      },
    },
    bscmainnet: {
      url: "https://bsc-dataseed1.ninicoin.io",
      chainId: 56,
      live: true,
      accounts: {
        mnemonic: process.env.MNEMONIC || "",
      },
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      bscmainnet: process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      bsctestnet: process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
    },
  },
  paths: {
    tests: "./test",
  },
  // Hardhat deploy
  namedAccounts: {
    deployer: 0,
  },
  docgen: {
    outputDir: "./docs",
    pages: "files",
    templates: "./docgen-templates",
  },
};

function isFork() {
  return process.env.FORK_MAINNET === "true"
    ? {
        allowUnlimitedContractSize: false,
        loggingEnabled: false,
        forking: {
          url: process.env.QUICK_NODE_URL || "",
          blockNumber: 26349263,
        },
        accounts: {
          accountsBalance: "1000000000000000000",
        },
        live: false,
      }
    : {
        allowUnlimitedContractSize: true,
        loggingEnabled: false,
        live: false,
      };
}

export default config;
