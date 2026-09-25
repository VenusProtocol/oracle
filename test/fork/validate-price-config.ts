/* eslint-disable no-restricted-syntax */
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Contract } from "ethers";
import { ethers } from "hardhat";

import { contracts as bscmainnet } from "../../deployments/bscmainnet.json";
import { contracts as bsctestnet } from "../../deployments/bsctestnet.json";
import { contracts as sepolia } from "../../deployments/sepolia.json";
import { assets } from "../../helpers/deploymentConfig";
import { forking } from "./utils";

const VALID = "\u2705"; // Unicode character for checkmark
const INVALID = "\u274c"; // Unicode character for X mark
const FORK: boolean = process.env.FORK === "true";
const FORKED_NETWORK: string = process.env.FORKED_NETWORK || "";

const oracleAddress = {
  bsctestnet: bsctestnet.ResilientOracle.address,
  sepolia: sepolia.ResilientOracle.address,
  bscmainnet: bscmainnet.ResilientOracle.address,
};

type FakeVtokenInfo = {
  address: string;
  name: string;
};

type PriceResult = {
  asset: string;
  validPrice: string;
  errorReason: string;
};

type BlockConfig = {
  [key: string]: number;
};

const blockNumberPerNetwork: BlockConfig = {
  bscmainnet: 27541139,
  bsctestnet: 29044518,
  sepolia: 4744320,
};

const blockNumer = blockNumberPerNetwork[FORKED_NETWORK];

// NOTE: in order to test the configuration, the blockNumber should be after the configuration transaction took place
if (FORK) {
  forking(blockNumer, () => {
    let oracle: Contract;
    let admin: SignerWithAddress;
    let VBep20HarnessFactory;
    let fakeVTokens: Array<FakeVtokenInfo>;
    describe(`Price configuration validation for network ${FORKED_NETWORK}`, () => {
      before(async () => {
        fakeVTokens = [];
        [admin] = await ethers.getSigners();
        oracle = await ethers.getContractAt("ResilientOracle", oracleAddress[FORKED_NETWORK]);
        VBep20HarnessFactory = await ethers.getContractFactory("VBEP20Harness", admin);
        for (const asset of assets[FORKED_NETWORK]) {
          console.log(`Deploying mock vToken for asset ${asset.token}`);
          const vBep20 = await VBep20HarnessFactory.deploy(asset.token, asset.token, 18, asset.address);
          const tokenInfo: FakeVtokenInfo = {
            address: vBep20.address,
            name: asset.token,
          };
          fakeVTokens.push(tokenInfo);
        }
      });

      it("Validate config for each asset", async () => {
        const results: PriceResult[] = [];
        let priceResult: PriceResult;
        for (const fakeVToken of fakeVTokens) {
          try {
            console.log(`Checking price for ${fakeVToken.name}...`);
            await oracle.getUnderlyingPrice(fakeVToken.address);
            priceResult = {
              asset: fakeVToken.name,
              validPrice: VALID,
              errorReason: "N/A",
            };
            console.log(`Valid`);
            results.push(priceResult);
          } catch (err) {
            priceResult = {
              asset: fakeVToken.name,
              validPrice: INVALID,
              errorReason: err.reason,
            };
            console.log(`Invalid`);
            results.push(priceResult);
          }
        }
        console.table(results, ["asset", "validPrice", "errorReason"]);
      }).timeout(1000000);
    });
  });
}
