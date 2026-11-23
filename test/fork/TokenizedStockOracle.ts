import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { contracts as bscmainnet } from "../../deployments/bscmainnet.json";
import { ADDRESSES } from "../../helpers/deploymentConfig";
import { ResilientOracle, TokenizedStockOracle } from "../../typechain-types";
import { forking, initMainnetUser } from "./utils";

const FORK: boolean = process.env.FORK === "true";
const FORKED_NETWORK: string = process.env.FORKED_NETWORK || "";

// After SNDKB's 8:1 split (uiMultiplier 8e18 since 2026-11-20 01:00 UTC). Its APRO pivot is disabled at this block.
const FORK_BLOCK = 135188000;

const EXP_SCALE = parseUnits("1", 18);
const PIVOT = 1;

// Every asset the APROOracle has a feed for: all are bStocks
const APRO_ASSETS: Record<string, string> = {
  NVDAB: "0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436",
  TSLAB: "0x5b1910eAaD6450E50f816082Aa078C41F10C292f",
  SPCXB: "0xbe9D156892E55e7154BcD3cB0FEA677F9D3103E1",
  SKHYB: "0xCA750eF65f295BBECd685Abf54e82CAf297BDB61",
  CRCLB: "0x80f3D493EBCe97e343c53D29a137942416B4ffC0",
  METAB: "0x7425889FE94F9d693E8daefE88BCCed6AcFEf4c0",
  MSFTB: "0x80106cb3EAD06659A5ad19DF39D9b4733863B9b0",
  MUB: "0xcdf2f3e0fa43C47A6662a91C9E4a7C5f69762699",
  QQQB: "0x205812CdBed920aFf76C6580abD681a46D11efc7",
  SNDKB: "0x3eE4dF61bd4F867E349BEaE8bFE07bc31b4850fb",
};
const { SNDKB } = APRO_ASSETS;

const PROXY_ADMIN_ABI = [
  "function upgrade(address proxy, address implementation)",
  "function getProxyImplementation(address proxy) view returns (address)",
];
const ACM_ABI = ["function giveCallPermission(address contractAddress, string functionSig, address accountToPermit)"];
const TOKENIZED_STOCK_ABI = ["function uiMultiplier() view returns (uint256)"];

if (FORK && FORKED_NETWORK === "bscmainnet") {
  forking(FORK_BLOCK, () => {
    describe("APROOracle upgraded to TokenizedStockOracle", () => {
      let aproOracle: TokenizedStockOracle;
      let atlasOracle: Contract;
      let resilientOracle: ResilientOracle;
      let proxyAdmin: Contract;
      let timelock: Awaited<ReturnType<typeof initMainnetUser>>;
      const feedsBefore: Record<string, string> = {};
      const aproPricesBefore: Record<string, BigNumber> = {};
      const resilientPricesBefore: Record<string, BigNumber> = {};
      const multipliers: Record<string, BigNumber> = {};

      before(async () => {
        timelock = await initMainnetUser(ADDRESSES.bscmainnet.timelock, parseUnits("1", 18));
        aproOracle = await ethers.getContractAt("TokenizedStockOracle", bscmainnet.APROOracle.address);
        atlasOracle = await ethers.getContractAt("ChainlinkOracle", bscmainnet.AtlasOracle.address);
        resilientOracle = await ethers.getContractAt("ResilientOracle", bscmainnet.ResilientOracle.address);
        proxyAdmin = await ethers.getContractAt(PROXY_ADMIN_ABI, bscmainnet.DefaultProxyAdmin.address);

        for (const [symbol, asset] of Object.entries(APRO_ASSETS)) {
          feedsBefore[symbol] = (await aproOracle.tokenConfigs(asset)).feed;
          aproPricesBefore[symbol] = await aproOracle.getPrice(asset);
          resilientPricesBefore[symbol] = await resilientOracle.getPrice(asset);
          multipliers[symbol] = await (await ethers.getContractAt(TOKENIZED_STOCK_ABI, asset)).uiMultiplier();
        }

        const implementation = await (await ethers.getContractFactory("TokenizedStockOracle")).deploy();
        await proxyAdmin.connect(timelock).upgrade(aproOracle.address, implementation.address);
        expect(await proxyAdmin.getProxyImplementation(aproOracle.address)).to.equal(implementation.address);

        const acm = await ethers.getContractAt(ACM_ABI, ADDRESSES.bscmainnet.acm);
        await acm
          .connect(timelock)
          .giveCallPermission(aproOracle.address, "setIsTokenizedStock(address,bool)", timelock.address);
        await acm
          .connect(timelock)
          .giveCallPermission(resilientOracle.address, "enableOracle(address,uint8,bool)", timelock.address);
      });

      it("keeps every feed and price while no asset is flagged", async () => {
        for (const [symbol, asset] of Object.entries(APRO_ASSETS)) {
          expect((await aproOracle.tokenConfigs(asset)).feed).to.equal(feedsBefore[symbol]);
          expect(await aproOracle.getPrice(asset)).to.equal(aproPricesBefore[symbol]);
          expect(await aproOracle.isTokenizedStock(asset)).to.equal(false);
        }
      });

      it("prices SNDKB per share before flagging, 8x below Atlas, so re-enabling its pivot breaks it", async () => {
        expect(multipliers.SNDKB).to.equal(parseUnits("8", 18));
        const atlasPrice: BigNumber = await atlasOracle.getPrice(SNDKB);
        expect(atlasPrice.div(aproPricesBefore.SNDKB)).to.equal(8);

        await resilientOracle.connect(timelock).enableOracle(SNDKB, PIVOT, true);
        await expect(resilientOracle.getPrice(SNDKB)).to.be.revertedWith("invalid resilient oracle price");
        await resilientOracle.connect(timelock).enableOracle(SNDKB, PIVOT, false);
      });

      describe("after flagging the APRO assets", () => {
        before(async () => {
          for (const asset of Object.values(APRO_ASSETS)) {
            await aproOracle.connect(timelock).setIsTokenizedStock(asset, true);
          }
        });

        it("scales each APRO price by the token's uiMultiplier", async () => {
          for (const symbol of Object.keys(APRO_ASSETS)) {
            expect(await aproOracle.getPrice(APRO_ASSETS[symbol])).to.equal(
              aproPricesBefore[symbol].mul(multipliers[symbol]).div(EXP_SCALE),
            );
          }
        });

        it("leaves the resilient price of every APRO asset unchanged", async () => {
          for (const [symbol, asset] of Object.entries(APRO_ASSETS)) {
            expect(await resilientOracle.getPrice(asset)).to.equal(resilientPricesBefore[symbol]);
          }
        });

        it("lets SNDKB's APRO pivot be re-enabled with the Atlas price passing validation", async () => {
          await resilientOracle.connect(timelock).enableOracle(SNDKB, PIVOT, true);

          const config = await resilientOracle.getTokenConfig(SNDKB);
          expect(config.enableFlagsForOracles[PIVOT]).to.equal(true);
          expect(await resilientOracle.getPrice(SNDKB)).to.equal(await atlasOracle.getPrice(SNDKB));
        });
      });
    });
  });
}
