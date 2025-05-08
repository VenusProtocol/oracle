import "module-alias/register";

import "@matterlabs/hardhat-zksync";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-verify";
import "@nomicfoundation/hardhat-chai-matchers";
import "@typechain/hardhat";
import * as dotenv from "dotenv";
import "hardhat-dependency-compiler";
import "hardhat-deploy";
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
          url: process.env[`ARCHIVE_NODE_${process.env.FORKED_NETWORK}`] || "https://sepolia.era.zksync.dev",
        },
        accounts: {
          accountsBalance: "1000000000000000000",
        },
        live: false,
        saveDeployments: false,
        zksync: true,
      }
    : {
        allowUnlimitedContractSize: true,
        loggingEnabled: false,
        live: false,
        saveDeployments: false,
        zksync: true,
      };
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  zksolc: {
    version: "1.5.1",
    compilerSource: "binary",
    settings: {
      metadata: {
        // do not include the metadata hash, since this is machine dependent
        // and we want all generated code to be deterministic
        // https://docs.soliditylang.org/en/v0.7.6/metadata.html
        bytecodeHash: "none",
      },
    },
  },
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
          evmVersion: "cancun",
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
    zksyncsepolia: {
      url: process.env.ARCHIVE_NODE_zksyncsepolia || "https://sepolia.era.zksync.dev",
      ethNetwork: "sepolia",
      verifyURL: "https://explorer.sepolia.era.zksync.dev/contract_verification",
      accounts: {
        mnemonic: process.env.MNEMONIC || ""
      },
      zksync: true,
      live: true,
      gasPrice: 2000000000, // 20 gwei
    },
    zksyncmainnet: {
      url: process.env.ARCHIVE_NODE_zksyncmainnet || "https://mainnet.era.zksync.io",
      ethNetwork: "mainnet",
      verifyURL: "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
      accounts: {
        mnemonic: process.env.MNEMONIC || ""
      },
      zksync: true,
      live: true,
    },
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

  dependencyCompiler: {
    paths: [
      "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol",
      "hardhat-deploy/solc_0.8/proxy/OptimizedTransparentUpgradeableProxy.sol",
      "hardhat-deploy/solc_0.8/openzeppelin/proxy/transparent/ProxyAdmin.sol",
    ],
  },
  paths: {
    tests: "./tests",
    cache: "./cache-zk",
    artifacts: "./artifacts-zk",
  },
};

export default config;
