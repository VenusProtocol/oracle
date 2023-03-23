import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Contract } from "ethers";
import { ethers } from "hardhat";

import { assets } from "../../deploy/2-configure-feeds";
import { forking } from "./utils";

const network = "bsctestnet";
const VALID = "\u2705";
const INVALID = "\u274c";

type FakeVtokenInfo = {
  address: string;
  name: string;
};

forking(28099700, () => {
  let oracle: Contract;
  let admin: SignerWithAddress;
  let VBep20HarnessFactory;
  let fakeVTokens: Array<FakeVtokenInfo>;
  describe(`Price configuration validation for network ${network}`, () => {
    before(async () => {
      fakeVTokens = [];
      [admin] = await ethers.getSigners();
      oracle = await ethers.getContractAt("ResilientOracle", "0xb0de3Fce006d3434342383f941bD22720Ff9Fc0C");
      VBep20HarnessFactory = await ethers.getContractFactory("VBEP20Harness", admin);
      for (const asset of assets[network]) {
        const vBep20 = await VBep20HarnessFactory.deploy(asset.token, asset.token, 18, asset.address);
        const tokenInfo: FakeVtokenInfo = {
          address: vBep20.address,
          name: asset.token,
        };
        fakeVTokens.push(tokenInfo);
      }
    });

    it("Validate config for each asset", async () => {
      for (const fakeVToken of fakeVTokens) {
        try {
          await oracle.getUnderlyingPrice(fakeVToken.address);
          console.log(`     ${fakeVToken.name} - ${VALID}`);
        } catch (err) {
          console.log(`     ${fakeVToken.name} - ${INVALID}`);
        }
      }
    });
  });
});
