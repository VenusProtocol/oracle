import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Contract } from "ethers";
import { ethers, network } from "hardhat";

import { assets } from "../../deploy/2-configure-feeds";
import { forking } from "./utils";

const VALID = "\u2705"; // Unicode character for checkmark
const INVALID = "\u274c"; // Unicode character for X mark
const networkName: string = network.name === "bscmainnet" ? "bscmainnet" : "bsctestnet";
const oracleAddress = {
  bsctestnet: "0xb0de3Fce006d3434342383f941bD22720Ff9Fc0C",
  bscmainnet: "",
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

// NOTE: in order to test the configuration, the blockNumber should be after the configuration transaction took place
const blockNumer = 28300935;
forking(blockNumer, () => {
  let oracle: Contract;
  let admin: SignerWithAddress;
  let VBep20HarnessFactory;
  let fakeVTokens: Array<FakeVtokenInfo>;
  describe(`Price configuration validation for network ${networkName}`, () => {
    before(async () => {
      fakeVTokens = [];
      [admin] = await ethers.getSigners();
      oracle = await ethers.getContractAt("ResilientOracle", oracleAddress[networkName]);
      VBep20HarnessFactory = await ethers.getContractFactory("VBEP20Harness", admin);
      for (const asset of assets[networkName]) {
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
