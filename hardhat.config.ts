import "module-alias/register";

import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import * as dotenv from "dotenv";
import "hardhat-dependency-compiler";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import { HardhatUserConfig, extendConfig } from "hardhat/config";
import { HardhatConfig } from "hardhat/types";
import "solidity-coverage";
import "solidity-docgen";

dotenv.config();

extendConfig((config: HardhatConfig) => {
  if (process.env.EXPORT !== "true") {
    // eslint-disable-next-line no-param-reassign
    config.external = {
      ...config.external,
      deployments: {
        // Define external deployments here
      },
    };
  }
});

function isFork() {
  return process.env.FORK === "true"
    ? {
        allowUnlimitedContractSize: false,
        loggingEnabled: false,
        forking: {
          url:
            process.env[`ARCHIVE_NODE_${process.env.FORKED_NETWORK}`] ||
            "https://data-seed-prebsc-1-s1.binance.org:8545",
        },
        accounts: {
          accountsBalance: "1000000000000000000",
        },
        live: false,
        saveDeployments: false,
      }
    : {
        allowUnlimitedContractSize: true,
        loggingEnabled: false,
        live: false,
        saveDeployments: false,
      };
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.25",
        settings: {
          optimizer: {
            enabled: true,
            details: {
              yul: !process.env.CI,
            },
          },
          evmVersion: "paris",
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
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
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
      url: process.env.ARCHIVE_NODE_bsctestnet || "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      live: true,
      gasPrice: 20000000000,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [`0x${process.env.DEPLOYER_PRIVATE_KEY}`] : [],
    },
    // Mainnet deployments are done through Frame wallet RPC
    bscmainnet: {
      url: process.env.ARCHIVE_NODE_bscmainnet || "https://bsc-dataseed.binance.org/",
      chainId: 56,
      live: true,
      timeout: 1200000, // 20 minutes
    },
    sepolia: {
      url: process.env.ARCHIVE_NODE_sepolia || "https://ethereum-sepolia.blockpi.network/v1/rpc/public",
      chainId: 11155111,
      live: true,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [`0x${process.env.DEPLOYER_PRIVATE_KEY}`] : [],
    },
    ethereum: {
      url: process.env.ARCHIVE_NODE_ethereum || "https://ethereum.blockpi.network/v1/rpc/public",
      chainId: 1,
      live: true,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [`0x${process.env.DEPLOYER_PRIVATE_KEY}`] : [],
    },
    opbnbtestnet: {
      url: process.env.ARCHIVE_NODE_opbnbtestnet || "https://opbnb-testnet-rpc.bnbchain.org",
      chainId: 5611,
      live: true,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [`0x${process.env.DEPLOYER_PRIVATE_KEY}`] : [],
    },
    opbnbmainnet: {
      url: process.env.ARCHIVE_NODE_opbnbmainnet || "https://opbnb-mainnet-rpc.bnbchain.org",
      chainId: 204,
      live: true,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [`0x${process.env.DEPLOYER_PRIVATE_KEY}`] : [],
    },
    arbitrumsepolia: {
      url: process.env.ARCHIVE_NODE_arbitrumsepolia || "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      live: true,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [`0x${process.env.DEPLOYER_PRIVATE_KEY}`] : [],
    },
    arbitrumone: {
      url: process.env.ARCHIVE_NODE_arbitrumone || "https://arb1.arbitrum.io/rpc",
      chainId: 42161,
      live: true,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [`0x${process.env.DEPLOYER_PRIVATE_KEY}`] : [],
    },
    opsepolia: {
      url: process.env.ARCHIVE_NODE_opsepolia || "https://sepolia.optimism.io",
      chainId: 11155420,
      live: true,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [`0x${process.env.DEPLOYER_PRIVATE_KEY}`] : [],
    },
    opmainnet: {
      url: process.env.ARCHIVE_NODE_opmainnet || "https://mainnet.optimism.io",
      chainId: 10,
      live: true,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [`0x${process.env.DEPLOYER_PRIVATE_KEY}`] : [],
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
      sepolia: process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      ethereum: process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      opbnbtestnet: process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      opbnbmainnet: process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      arbitrumsepolia: process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      arbitrumone: process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      opsepolia: process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
      opmainnet: process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
    },
    customChains: [
      {
        network: "bscmainnet",
        chainId: 56,
        urls: {
          apiURL: "https://api.bscscan.com/api",
          browserURL: "https://bscscan.com",
        },
      },
      {
        network: "bsctestnet",
        chainId: 97,
        urls: {
          apiURL: "https://api-testnet.bscscan.com/api",
          browserURL: "https://testnet.bscscan.com",
        },
      },
      {
        network: "sepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://api-sepolia.etherscan.io/api",
          browserURL: "https://sepolia.etherscan.io",
        },
      },
      {
        network: "ethereum",
        chainId: 1,
        urls: {
          apiURL: "https://api.etherscan.io/api",
          browserURL: "https://etherscan.io",
        },
      },
      {
        network: "opbnbtestnet",
        chainId: 5611,
        urls: {
          apiURL: `https://open-platform.nodereal.io/${process.env.ETHERSCAN_API_KEY}/op-bnb-testnet/contract/`,
          browserURL: "https://testnet.opbnbscan.com/",
        },
      },
      {
        network: "opbnbmainnet",
        chainId: 204,
        urls: {
          apiURL: `https://open-platform.nodereal.io/${process.env.ETHERSCAN_API_KEY}/op-bnb-mainnet/contract/`,
          browserURL: "https://opbnbscan.com/",
        },
      },
      {
        network: "arbitrumsepolia",
        chainId: 421614,
        urls: {
          apiURL: `https://api-sepolia.arbiscan.io/api`,
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
      {
        network: "arbitrumone",
        chainId: 42161,
        urls: {
          apiURL: `https://api.arbiscan.io/api/`,
          browserURL: "https://arbiscan.io/",
        },
      },
      {
        network: "opsepolia",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api/",
          browserURL: "https://sepolia-optimistic.etherscan.io/",
        },
      },
      {
        network: "opmainnet",
        chainId: 10,
        urls: {
          apiURL: "https://api-optimistic.etherscan.io/api",
          browserURL: "https://optimistic.etherscan.io/",
        },
      },
    ],
  },
  paths: {
    tests: "./test",
  },
  dependencyCompiler: {
    paths: [
      "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol",
      "hardhat-deploy/solc_0.8/proxy/OptimizedTransparentUpgradeableProxy.sol",
      "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol",
      "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
    ],
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

export default config;
